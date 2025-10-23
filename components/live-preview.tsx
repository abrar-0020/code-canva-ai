// src/components/live-preview.tsx
"use client"

import { useState, useMemo } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReactLivePreview } from "./ReactLivePreview"

type DeviceType = "desktop" | "mobile"
type Framework = 'html' | 'react' | 'vue' | 'nextjs';

interface LivePreviewProps {
  code: string;
  framework: Framework;
}

export function LivePreview({ code, framework }: LivePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>("desktop")

  const deviceWidths = {
    desktop: "w-full",
    mobile: "w-[375px] max-w-full",
  }

  const iframeContent = useMemo(() => {
    if (framework !== 'html') return '';

    // Convert JSX comments to HTML comments before rendering
    const sanitizedCode = code.replace(/{\s*\/\*\s*(.*?)\s*\*\/\s*}/g, '<!-- $1 -->');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeCanvas Preview</title>
        <script>
          // Minimal Tailwind CSS runtime
          let tw = {
            config: {},
            init: function() {
              this.injectBaseStyles();
              this.processElements();
            },
            injectBaseStyles: function() {
              const style = document.createElement('style');
              style.textContent = \`
                *, ::before, ::after { box-sizing: border-box; }
                * { margin: 0; }
                body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
                img, picture, video, canvas, svg { display: block; max-width: 100%; }
                input, button, textarea, select { font: inherit; }
                p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
              \`;
              document.head.appendChild(style);
            },
            processElements: function() {
              // Simple class processor for common Tailwind classes
              const elements = document.querySelectorAll('[class]');
              elements.forEach(el => {
                const classes = el.className.split(' ');
                classes.forEach(cls => {
                  if (this.classMap[cls]) {
                    el.style.cssText += this.classMap[cls];
                  }
                });
              });
            },
            classMap: {
              // Layout
              'flex': 'display: flex;',
              'block': 'display: block;',
              'inline': 'display: inline;',
              'hidden': 'display: none;',
              'relative': 'position: relative;',
              'absolute': 'position: absolute;',
              'fixed': 'position: fixed;',
              // Spacing
              'p-4': 'padding: 1rem;',
              'm-4': 'margin: -1rem;',
              'mx-auto': 'margin-left: auto; margin-right: auto;',
              // Colors
              'bg-white': 'background-color: white;',
              'bg-black': 'background-color: black;',
              'bg-gray-100': 'background-color: #f3f4f6;',
              'text-black': 'color: black;',
              'text-white': 'color: white;',
              'text-gray-500': 'color: #6b7280;',
              // Typography
              'text-center': 'text-align: center;',
              'text-lg': 'font-size: 1.125rem; line-height: 1.75rem;',
              'font-bold': 'font-weight: 700;',
              // Width/Height
              'w-full': 'width: 100%;',
              'h-full': 'height: 100%;',
              // Border
              'border': 'border-width: 1px; border-style: solid; border-color: #d1d5db;',
              'rounded': 'border-radius: 0.25rem;',
              'rounded-lg': 'border-radius: 0.5rem;',
            }
          };
          document.addEventListener('DOMContentLoaded', function() { tw.init(); });
        </script>
        <style>
          body { margin: 0; padding: 0; height: 100vh; background-color: white; }
        </style>
      </head>
      <body>
        ${sanitizedCode}
      </body>
      </html>
    `;
  }, [code, framework]);


  const renderPreviewContent = () => {
    if (framework === 'html') {
        return (
             <iframe
                title="Live Code Preview"
                className="w-full h-full border-none rounded-lg"
                srcDoc={iframeContent}
                sandbox="allow-scripts"
            />
        );
    } else if (framework === 'react' || framework === 'nextjs') {
        return <ReactLivePreview code={code} />;
    } else if (framework === 'vue') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Vue Live Preview is deferred. Showing generated code in the editor.
            </div>
        );
    }
    return (
        <div className="p-8 text-center text-muted-foreground">
            No preview available for this framework.
        </div>
    );
  };


  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-medium text-muted-foreground">Live Preview ({framework.toUpperCase()})</h2>
        <div className="flex items-center gap-1">
          <Button
            variant={selectedDevice === "desktop" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedDevice("desktop")}
            className="h-8 w-8 p-0"
          >
            <Monitor className="h-4 w-4" />
            <span className="sr-only">Desktop view</span>
          </Button>
          <Button
            variant={selectedDevice === "mobile" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedDevice("mobile")}
            className="h-8 w-8 p-0"
          >
            <Smartphone className="h-4 w-4" />
            <span className="sr-only">Mobile view</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-6 bg-muted">
        <div
          className={`${deviceWidths[selectedDevice]} h-full rounded-lg border-2 border-border bg-background transition-all duration-300 shadow-xl`}
        >
          {renderPreviewContent()}
        </div>
      </div>
    </div>
  )
}