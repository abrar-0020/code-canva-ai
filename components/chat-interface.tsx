// src/components/chat-interface.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Image, X } from "lucide-react" 
import { toast } from "sonner"; 

type Framework = 'html' | 'react' | 'vue' | 'nextjs';

export interface Message {
  id: string
  role: "user" | "ai"
  content: string
  timestamp: Date
  code?: string 
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (prompt: string, imageFile: File | null) => void 
  onRegenerateMessage: (messageId: string) => void
  isGenerating: boolean; 
  selectedFramework: Framework;
  setSelectedFramework: (f: Framework) => void;
  streamingCode?: string;
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onRegenerateMessage, 
  isGenerating,
  selectedFramework,
  setSelectedFramework,
  streamingCode
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !imageFile) {
      toast.error('Please enter a prompt or upload an image.'); 
      return;
    }
    if (isGenerating) return;

    onSendMessage(input.trim(), imageFile);
    setInput("");
    setImageFile(null); 
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are supported.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { 
        toast.error('Image is too large. Max 10MB.');
        setImageFile(null);
        e.target.value = ''; 
        return;
      }
      setImageFile(file);
      toast.success(`Image uploaded: ${file.name}`, { duration: 1500 }); 
    }
  };

  const handleDownloadCode = (code: string, fileName: string) => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Start a conversation...</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 shadow-md ${
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground" 
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                
                {message.role === "ai" && (
                  <div className="mt-2 flex justify-end space-x-2">
                    {message.code && (
                       <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => handleDownloadCode(message.code!, `ai_code_${selectedFramework}.txt`)}
                      >
                        <Download className="h-3 w-3" />
                        Code
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => onRegenerateMessage(message.id)}
                      disabled={isGenerating}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isGenerating && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-2 bg-secondary text-secondary-foreground shadow-md">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
                <p className="text-sm leading-relaxed">AI is generating code...</p>
              </div>
            </div>
          </div>
        )}
        
        {streamingCode && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-secondary text-secondary-foreground shadow-md overflow-hidden">
              <div className="p-2 border-b border-border">
                <p className="text-xs text-muted-foreground">Streaming Code Generation ({selectedFramework.toUpperCase()})</p>
              </div>
              <pre 
                style={{
                  color: 'rgb(248, 248, 242)',
                  background: 'rgb(40, 42, 54)',
                  textShadow: 'rgba(0, 0, 0, 0.3) 0px 1px',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'left',
                  whiteSpace: 'pre',
                  wordSpacing: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  lineHeight: '1.5',
                  tabSize: '4',
                  hyphens: 'none',
                  padding: '1.25rem',
                  margin: '0px',
                  overflow: 'auto',
                  borderRadius: '0.3em',
                  minHeight: '100%',
                  fontSize: '14px'
                }}
              >
                <code 
                  className={`language-${selectedFramework === 'react' || selectedFramework === 'nextjs' ? 'jsx' : selectedFramework === 'vue' ? 'vue' : 'html'}`}
                  style={{
                    whiteSpace: 'pre',
                    color: 'rgb(248, 248, 242)',
                    background: 'none',
                    textShadow: 'rgba(0, 0, 0, 0.3) 0px 1px',
                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                    textAlign: 'left',
                    wordSpacing: 'normal',
                    wordBreak: 'normal',
                    overflowWrap: 'normal',
                    lineHeight: '1.5',
                    tabSize: '4',
                    hyphens: 'none'
                  }}
                >
                  {streamingCode}
                </code>
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        {/* FRAMEWORK SELECTION UI */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Target Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value as Framework)}
            className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            disabled={isGenerating}
          >
            <option value="html">HTML/CSS/Vanilla JS (Default)</option>
            <option value="react">React + Tailwind</option>
            <option value="nextjs">Next.js Component</option>
            <option value="vue">Vue 3 + Tailwind</option>
          </select>
        </div>
        {/* END FRAMEWORK SELECTION UI */}

        {imageFile && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-accent p-2 text-sm text-accent-foreground">
            <div className="flex items-center space-x-2">
              <Image className="h-4 w-4" />
              <span>Image Ready: {imageFile.name}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageFile(null)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isGenerating ? "Please wait..." : "Describe the component..."}
              className="w-full rounded-md border border-input bg-background pr-10 pl-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              disabled={isGenerating}
            />
            <label className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <Image className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </label>
          </div>
          
          <Button type="submit" size="sm" disabled={isGenerating}>
            Generate
          </Button>
        </form>
      </div>
    </div>
  )
}