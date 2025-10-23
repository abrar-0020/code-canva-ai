// src/app/page.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChatInterface, type Message } from "@/components/chat-interface"
import { CodeEditor } from "@/components/code-editor"
import { LivePreview } from "@/components/live-preview"
import { Toaster, toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'; 
import { ThemeToggle } from "@/components/theme-toggle"; 
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { 
  PanelGroup, 
  Panel, 
  PanelResizeHandle 
} from "react-resizable-panels";
import Link from 'next/link'; 

type Framework = 'html' | 'react' | 'vue' | 'nextjs';

interface CodeFile {
  id: string
  name: string
  content: string
}

const INITIAL_CODE = `
<div class="flex items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-[var(--color-panel-preview)]">
  <div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
    <h1 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">CodeCanvas AI Ready</h1>
    <p class="mt-2 text-gray-700 dark:text-gray-300">Start by typing a request in the chat panel or uploading an image.</p>
  </div>
</div>
`

export default function CodeCanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeFileId, setActiveFileId] = useState("1") 
  const [selectedFramework, setSelectedFramework] = useState<Framework>('html'); 
  
  const [files, setFiles] = useState<CodeFile[]>([
    { id: "1", name: "App.jsx", content: INITIAL_CODE },
  ])
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuidv4(),
      role: "ai",
      content: "Hello! I'm CodeCanvas AI. Describe the component you want to build, or just say hi!",
      timestamp: new Date(),
    },
  ])
  
  const [streamingCode, setStreamingCode] = useState<string>("")

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId) || files[0], [files, activeFileId])

  // Protect the page - redirect to sign-in if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in')
    }
  }, [user, loading, router])

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      router.push('/sign-in')
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated
  if (!user) return null
  
  const handleFileContentChange = (fileId: string, newContent: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: newContent } : f))
  }

  // --- THIS IS THE MODIFIED FUNCTION ---
  const handleSendMessage = async (prompt: string, imageFile: File | null) => {
    if (isGenerating) return;

    const userPromptContent = imageFile 
      ? `Image upload: ${imageFile.name}${prompt ? ` with prompt: "${prompt}"` : ''}` 
      : prompt;
      
    const newUserMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: userPromptContent,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newUserMessage])
    
    setIsGenerating(true)
    
    let base64Image: string | null = null;

    if (imageFile) {
        try {
            base64Image = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]); // Get only the base64 part
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        } catch (error) {
            toast.error("Failed to read image file.");
            setIsGenerating(false);
            return;
        }
    }

    const aiMessageId = uuidv4();
    let streamedContent = "";
    setStreamingCode(""); // Reset streaming code
    
    setMessages((prev) => [...prev, {
      id: aiMessageId,
      role: "ai",
      content: "...", 
      timestamp: new Date(),
    }]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, base64Image, framework: selectedFramework }), 
      });

      if (!response.ok || !response.body) {
        throw new Error(`API returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isFirstChunk = true;
      let responseType: 'CHAT' | 'CODE' | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value, { stream: true });
        
        if (isFirstChunk) {
          if (chunk.startsWith("CHAT:")) {
            responseType = "CHAT";
            chunk = chunk.substring(5);
          } else if (chunk.startsWith("CODE:")) {
            responseType = "CODE";
            chunk = chunk.substring(5);
          }
          isFirstChunk = false;
        }

        streamedContent += chunk;

        if (responseType === "CHAT") {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, content: streamedContent } : msg
          ));
        } else if (responseType === "CODE") {
          // Update streaming code display in real-time
          setStreamingCode(streamedContent);
          // Also update the file content for the editor
          handleFileContentChange(activeFileId, streamedContent);
          // Update the message to show streaming status
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId ? { 
              ...msg, 
              content: `Generating ${selectedFramework.toUpperCase()} code...`,
              code: streamedContent 
            } : msg
          ));
          // Debug: Log streaming progress
          console.log('Streaming code update:', streamedContent.length, 'characters');
        }
      }
      
      if (responseType === "CODE") {
        // Update final message
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { 
            ...msg, 
            content: `${selectedFramework.toUpperCase()} code generated successfully!`,
            code: streamedContent 
          } : msg
        ));
        toast.success(`${selectedFramework.toUpperCase()} code generation complete!`);
      }

    } catch (error) {
      console.error(error);
      toast.error("An error occurred during AI generation.");
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, content: 'Error: Could not generate a response.' } : msg
      ));
    } finally {
      setIsGenerating(false);
      // Clear streaming code after a short delay to show completion
      setTimeout(() => {
        setStreamingCode("");
      }, 1000);
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.content)
    toast.success("Code copied to clipboard!")
  }

  const handleDownloadCode = () => {
    const element = document.createElement("a");
    const file = new Blob([activeFile.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = activeFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Downloading ${activeFile.name}...`)
  }

  const handleFormatCode = () => {
    toast.info("Formatting not enabled yet.")
  }
  
  const handleRegenerateMessage = (messageId: string) => {
    toast.info("Regenerate not enabled yet. Try a new prompt.")
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Toaster position="bottom-right" />
      
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="font-mono text-lg font-semibold text-foreground">CodeCanvas AI</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle /> 
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
          <Link href="/get-started" passHref><Button size="sm">Get Started</Button></Link>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          
          <Panel defaultSize={25} minSize={20} maxSize={50} className="w-full">
            <aside className="flex h-full flex-col border-r border-border bg-[var(--color-panel-chat)]">
              <div className="flex h-12 items-center border-b border-border px-4">
                <h2 className="text-sm font-medium text-muted-foreground">AI Input</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onRegenerateMessage={handleRegenerateMessage}
                  isGenerating={isGenerating}
                  selectedFramework={selectedFramework}
                  setSelectedFramework={setSelectedFramework as any}
                  streamingCode={streamingCode}
                />
              </div>
            </aside>
          </Panel>

          <PanelResizeHandle className="w-2 bg-transparent hover:bg-border/50 transition-colors" />

          <Panel defaultSize={40} minSize={30}>
            <section className="flex h-full flex-col border-r border-border bg-[var(--color-panel-editor)]">
              <CodeEditor
                files={files}
                activeFileId={activeFileId}
                onTabChange={setActiveFileId}
                onFileContentChange={handleFileContentChange}
                onCopyCode={handleCopyCode}
                onFormatCode={handleFormatCode}
                onDownloadCode={handleDownloadCode}
                framework={selectedFramework}
              />
            </section>
          </Panel>

          <PanelResizeHandle className="w-2 bg-transparent hover:bg-border/50 transition-colors" />

          <Panel defaultSize={40} minSize={30}>
            <section className="flex h-full flex-col bg-[var(--color-panel-preview)]">
              <LivePreview 
                code={activeFile.content.replace(/ /g, '')} 
                framework={selectedFramework} 
              />
            </section>
          </Panel>
          
        </PanelGroup>
      </main>
      
      <footer className="flex h-8 items-center justify-center text-xs border-t border-border bg-background text-muted-foreground">
        <Link href="/pricing" className="px-3 hover:text-foreground">Pricing</Link>
        <span className="text-border">|</span>
        <Link href="/terms" className="px-3 hover:text-foreground">Terms</Link>
        <span className="text-border">|</span>
        <Link href="/privacy" className="px-3 hover:text-foreground">Privacy</Link>
      </footer>
    </div>
  )
}