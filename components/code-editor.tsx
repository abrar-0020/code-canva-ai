// src/components/code-editor.tsx
"use client"

import { Copy, Code, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula, atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes'; 


interface CodeFile {
  id: string
  name: string
  content: string 
}

interface CodeEditorProps {
  files: CodeFile[]
  activeFileId: string
  onTabChange: (fileId: string) => void
  onFileContentChange: (fileId: string, newContent: string) => void
  onCopyCode: () => void
  onFormatCode: () => void
  onDownloadCode: () => void
  framework: string;
}

const getLanguage = (framework: string) => {
    switch (framework) {
        case 'react':
        case 'nextjs':
            return 'jsx'; 
        case 'vue':
            return 'markup';
        case 'html':
        default:
            return 'html';
    }
}

export function CodeEditor({ 
  files, 
  activeFileId, 
  onTabChange, 
  onFileContentChange, 
  onCopyCode, 
  onFormatCode,
  onDownloadCode,
  framework
}: CodeEditorProps) {
  
  const activeFile = files.find(f => f.id === activeFileId);
  const codeContent = activeFile ? activeFile.content : "// File not found";

  const [isEditing, setIsEditing] = useState(false);
  const { resolvedTheme } = useTheme();
  const themeStyle = resolvedTheme === 'light' ? atomDark : dracula;
  const language = getLanguage(framework);

  // Use a consistent background color to avoid hydration mismatch
  const codeBackground = '#282a36';


  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-background px-2">
        
        <div className="flex items-center gap-1 overflow-x-auto">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onTabChange(file.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeFileId === file.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pr-2">
          <Button 
            variant={isEditing ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setIsEditing(prev => !prev)} 
            className="h-8 gap-2"
          >
            <Code className="h-4 w-4" />
            {isEditing ? "View Code" : "Edit Code"}
          </Button>

          <Button variant="ghost" size="sm" onClick={onFormatCode} className="h-8 gap-2">
            <Code className="h-4 w-4" />
            Format
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopyCode} className="h-8 gap-2">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownloadCode} className="h-8 gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-[var(--color-panel-editor)] overflow-auto">
        {isEditing ? (
          <textarea
            value={codeContent}
            onChange={(e) => onFileContentChange(activeFileId, e.target.value)}
            placeholder="// Code output will be streamed here..."
            className="h-full w-full resize-none font-mono text-sm bg-[var(--color-panel-editor)] text-foreground p-4 focus:outline-none"
            spellCheck="false"
          />
        ) : (
          <SyntaxHighlighter
            style={themeStyle}
            language={language}
            customStyle={{
              padding: '1.25rem',
              margin: 0,
              minHeight: '100%',
              backgroundColor: codeBackground,
              fontFamily: 'var(--font-mono)', 
              fontSize: '14px',
            }}
            showLineNumbers={true}
            lineNumberStyle={{ color: '#6A6A6A', paddingRight: '15px' }}
          >
            {codeContent}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
}