# backend/agent_service.py
import os
import logging
import base64
from dotenv import load_dotenv
from typing import TypedDict, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
import time
from pydantic import BaseModel, validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Validate environment variables at startup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise ValueError("GEMINI_API_KEY must be set in .env file. Please create a .env file with GEMINI_API_KEY=your_key")

logger.info("✓ Environment variables validated successfully")

# --- Pydantic Validation Model ---
MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

class Message(BaseModel):
    role: str
    content: str

class GenerateRequest(BaseModel):
    prompt: str
    base64Image: str | None = None
    framework: str = "react"
    history: List[Message] = []

    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError("Prompt cannot be empty")
        if len(v) > 5000:
            raise ValueError("Prompt too long (max 5000 characters)")
        return v.strip()

    @validator('base64Image')
    def validate_base64_image(cls, v):
        if v is None:
            return v
        try:
            image_data = base64.b64decode(v)
            image_size = len(image_data)
            if image_size > MAX_IMAGE_SIZE_BYTES:
                raise ValueError(
                    f"Image too large: {image_size / 1024 / 1024:.1f}MB. "
                    f"Maximum allowed: {MAX_IMAGE_SIZE_MB}MB"
                )
            if not (image_data.startswith(b'\xff\xd8\xff') or  # JPEG
                    image_data.startswith(b'\x89PNG') or      # PNG
                    image_data.startswith(b'GIF')):           # GIF
                raise ValueError("Invalid image format. Only JPEG, PNG, and GIF are supported")
            return v
        except base64.binascii.Error:
            raise ValueError("Invalid base64 encoding")

    @validator('framework')
    def validate_framework(cls, v):
        valid_frameworks = ['html', 'react', 'vue', 'nextjs']
        if v not in valid_frameworks:
            raise ValueError(f"Invalid framework. Must be one of: {', '.join(valid_frameworks)}")
        return v

# --- 1. Define the State ---
class GraphState(TypedDict):
    prompt: str
    base64Image: str | None
    framework: str
    system_instruction: str
    model_parts: List
    generated_code: str
    error_message: str | None
    retry_count: int
    intent: str
    chat_response: str
    history: List[dict]

# --- 2. Define the Node Functions ---

def classify_intent_node(state: GraphState):
    """Classifies intent using an AI classifier (chat vs code_generation)."""
    logger.info("Classifying intent (AI-driven)...")
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY, temperature=0.0)
        classification_prompt = (
            "You are an intent classifier for an AI coding assistant. "
            "Decide whether the user's latest request should be handled as 'code_generation' or 'chat'.\n"
            "Rules:\n- Return EXACTLY one of: code_generation or chat.\n"
            "- Choose code_generation if the user asks to create, modify, design, implement, or generate code, or if an image is provided for UI to code.\n"
            "- Otherwise choose chat.\n\n"
            f"User prompt: {state['prompt']}\n"
            f"Image provided: {bool(state.get('base64Image'))}"
        )
        result = llm.invoke(classification_prompt)
        raw = (getattr(result, "content", "") or "").strip().lower()
        intent = "code_generation" if "code_generation" in raw else ("chat" if "chat" in raw else "chat")
        state["intent"] = intent
    except Exception as e:
        logger.error(f"Intent classification failed, defaulting to chat: {e}")
        state["intent"] = "chat"
    logger.info(f"✓ Intent classified as: {state['intent']}")
    return state

def chat_node(state: GraphState):
    """Generates a conversational response to the user's prompt, with history context."""
    logger.info("Generating chat response...")
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY, temperature=0.7)
    messages: List = []
    for m in state.get("history", []):
        role = m.get("role")
        content = m.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=state['prompt']))
    response_stream = llm.stream(messages)
    state["chat_response"] = response_stream
    return state

def prepare_code_prompt_node(state: GraphState):
    """Prepares the input for the Gemini model for code generation."""
    logger.info(f"Preparing code prompt for framework: {state['framework']}")
    parts = [{"type": "text", "text": state["prompt"]}]
    if state["base64Image"]:
        parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{state['base64Image']}"}
        })
    state["model_parts"] = parts
    return state

def generate_code_node(state: GraphState):
    """Generates code by calling the Gemini API, with conversation history as context."""
    logger.info(f"Generating code... (attempt {state.get('retry_count', 0) + 1})")
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=GEMINI_API_KEY,
            temperature=0.2,
            convert_system_message_to_human=True
        )
        history_messages: List = []
        for m in state.get("history", []):
            role = m.get("role")
            content = m.get("content", "")
            if role == "user":
                history_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                history_messages.append(AIMessage(content=content))
        message = HumanMessage(content=state["model_parts"])
        system_message = state["system_instruction"]
        payload = [system_message, *history_messages, message]
        response_stream = llm.stream(payload)
        state["generated_code"] = response_stream
        state["error_message"] = None
        logger.info("✓ Code generation successful")
    except Exception as e:
        logger.error(f"✗ Error in generation: {e}")
        state["error_message"] = str(e)
    return state

def handle_error_node(state: GraphState):
    """Handles errors and decides whether to retry with exponential backoff."""
    logger.warning("Handling error...")
    error = state.get("error_message", "")
    retries = state.get("retry_count", 0)
    
    is_retryable = ("503" in error or "overloaded" in error or 
                    "rate limit" in error.lower() or "timeout" in error.lower())
    
    if is_retryable and retries < 3:
        delay = 2 ** retries
        logger.info(f"⏳ Model overloaded, retrying in {delay}s... ({retries + 1}/3)")
        time.sleep(delay)
        state["retry_count"] = retries + 1
        return "generate_code"
    else:
        logger.error(f"✗ Unrecoverable error or max retries reached: {error}")
        state["generated_code"] = f"An error occurred: {error}"
        return END

# --- 3. Build the Graph with Routing Logic ---
workflow = StateGraph(GraphState)

workflow.add_node("classify_intent", classify_intent_node)
workflow.add_node("chat", chat_node)
workflow.add_node("prepare_code_prompt", prepare_code_prompt_node)
workflow.add_node("generate_code", generate_code_node)
workflow.add_node("handle_error", handle_error_node)

workflow.set_entry_point("classify_intent")
workflow.add_conditional_edges("classify_intent", lambda state: state["intent"], { "code_generation": "prepare_code_prompt", "chat": "chat" })
workflow.add_edge("chat", END)
workflow.add_edge("prepare_code_prompt", "generate_code")
workflow.add_conditional_edges("generate_code", lambda state: "handle_error" if state.get("error_message") else END)
workflow.add_edge("handle_error", "generate_code")

app_graph = workflow.compile()

# --- 4. Create FastAPI App to Serve the Agent ---
api = FastAPI(title="CodeCanvas AI API", description="AI-powered code generation service", version="1.0.0")

api.state.limiter = limiter
api.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("✓ CORS middleware configured")

@api.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "api_key_configured": bool(GEMINI_API_KEY)}

@api.post("/api/generate")
@limiter.limit("5/minute")
async def generate(request: Request, request_data: GenerateRequest):
    logger.info(f"Request received: framework={request_data.framework}, has_image={bool(request_data.base64Image)}")
    
    framework = request_data.framework
    
    # --- THIS IS THE FINAL, MORE FORCEFUL PROMPT LOGIC ---
    framework_instructions = {
        'react': "Generate a React JSX component. Use `className` for CSS classes. Use JSX comments {/* like this */}. Inline styles MUST be objects `style={{ key: 'value' }}`.",
        'nextjs': "Generate a Next.js React JSX component. Use `className` for CSS classes. Use JSX comments {/* like this */}. Inline styles MUST be objects `style={{ key: 'value' }}`.",
        'vue': "Generate a Vue 3 Single File Component. Use HTML comments <!-- ... -->.",
        'html': "Generate plain HTML. Use `class` for CSS classes. Use HTML comments <!-- ... -->. Inline styles MUST be strings `style=\"key: value;\"`."
    }
    
    selected_framework_details = framework_instructions.get(framework, framework_instructions['html'])

    system_instruction = f"""
    You are an expert code generation AI specialized in creating production-ready, beautiful, and functional components. Your mission is to generate high-quality code that works perfectly and looks amazing.

    CRITICAL REQUIREMENTS:
    - Framework: **{framework.upper()}**
    - Generate ONLY the component code, no explanations or markdown
    - Code must be immediately runnable and functional
    - Focus on modern, clean, and professional design
    - Use best practices for the selected framework

    FRAMEWORK-SPECIFIC RULES:
    {selected_framework_details}

    QUALITY STANDARDS:
    - Write clean, readable, and well-structured code
    - Use modern CSS techniques and responsive design
    - Implement proper accessibility features
    - Ensure the component is visually appealing
    - Use semantic HTML and proper component structure
    - Add appropriate hover states and interactions
    - Make it mobile-responsive

    OUTPUT FORMAT:
    - Return ONLY the component code
    - No markdown code blocks (```)
    - No explanations or comments outside the code
    - No wrapper tags like <html> or <body>
    - Self-contained component that works immediately

    Remember: You are creating production-quality code that developers will use in real projects. Make it exceptional.
    """
    
    initial_state = {
        "prompt": request_data.prompt,
        "base64Image": request_data.base64Image,
        "framework": request_data.framework,
        "system_instruction": system_instruction,
        "retry_count": 0,
        "history": [{"role": m.role, "content": m.content} for m in (request_data.history or [])]
    }

    async def stream_generator():
        try:
            async for chunk in app_graph.astream(initial_state):
                if "chat" in chunk:
                    chat_output = chunk["chat"].get("chat_response")
                    if chat_output:
                        yield "CHAT:"
                        for token in chat_output:
                            yield token.content
                        return
                if "generate_code" in chunk:
                    generate_output = chunk["generate_code"]
                    if generate_output and "generated_code" in generate_output and generate_output["generated_code"]:
                        generation_stream = generate_output["generated_code"]
                        yield "CODE:"
                        for token in generation_stream:
                            yield token.content
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"ERROR: {str(e)}"
    
    return StreamingResponse(stream_generator(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting CodeCanvas AI API server...")
    uvicorn.run("agent_service:api", host="0.0.0.0", port=8000, reload=True)
     
