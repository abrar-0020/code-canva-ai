"use client";

import React, { useMemo } from "react";
import { LiveProvider, LivePreview, LiveError } from "react-live";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "./ErrorBoundary";

const scope = {
  React,
  Button,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo,
  useCallback: React.useCallback,
  useRef: React.useRef,
};

interface ReactLivePreviewProps {
  code: string;
}

export function ReactLivePreview({ code }: ReactLivePreviewProps) {
  const cleanedCode = useMemo(() => {
    if (!code || !code.trim()) return '';

    try {
      // Remove markdown code fences
      let processedCode = code
        .replace(/^```(?:jsx|javascript|tsx|react)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      // Debug: Log the processed code
      console.log('Original code:', code.substring(0, 200) + '...');
      console.log('Processed code:', processedCode.substring(0, 200) + '...');

      // Check if it's a complete component definition
      const isCompleteComponent = /^(const|function|class)\s+\w+/i.test(processedCode);
      
      if (isCompleteComponent) {
        // It's already a component, extract the component name and render it
        const componentMatch = processedCode.match(/^(?:const|function|class)\s+(\w+)/);
        if (componentMatch) {
          const componentName = componentMatch[1];
          return `
${processedCode}

render(<${componentName} />);
          `;
        }
      }

      // It's raw JSX - find the first tag
      const firstTagMatch = processedCode.match(/</);
      if (!firstTagMatch) return '';

      const firstTagIndex = firstTagMatch.index || 0;
      processedCode = processedCode.substring(firstTagIndex);

      // Clean up HTML/JSX differences more carefully
      processedCode = processedCode
        .replace(/<!--\s*(.*?)\s*-->/g, '{/* $1 */}')  // HTML comments to JSX
        .replace(/\bclass=/g, 'className=')             // class to className
        .replace(/\bfor=/g, 'htmlFor=')                 // for to htmlFor
        .replace(/\bstyle="([^"]*)"/g, (match, styles) => {
          try {
            // Convert inline style strings to objects
            const styleObj = styles
              .split(';')
              .filter((s: string) => s.trim())
              .map((s: string) => {
                const [key, value] = s.split(':').map((p: string) => p.trim());
                if (!key || !value) return '';
                const camelKey = key.replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
                return `${camelKey}: '${value}'`;
              })
              .filter(Boolean)
              .join(', ');
            return `style={{${styleObj}}}`;
          } catch (e) {
            return match; // Return original if conversion fails
          }
        })
        // Fix common JSX syntax issues
        .replace(/\s+>/g, '>')  // Remove extra spaces before closing tags
        .replace(/<\s+/g, '<')  // Remove extra spaces after opening tags
        .replace(/\s+</g, '<')  // Remove extra spaces before opening tags
        .replace(/>\s+/g, '>')  // Remove extra spaces after closing tags
        // Fix self-closing tags
        .replace(/<(\w+)([^>]*?)\s*>\s*<\/\1>/g, '<$1$2 />')
        // Fix common attribute issues
        .replace(/(\w+)\s*=\s*{([^}]*)}/g, '$1={$2}')  // Fix spacing around attributes
        .replace(/(\w+)\s*=\s*"([^"]*)"/g, '$1="$2"');  // Fix spacing around string attributes

      // Wrap in component with better error handling
      const finalCode = `
const GeneratedComponent = () => {
  return (
    <React.Fragment>
      ${processedCode}
    </React.Fragment>
  );
};
render(<GeneratedComponent />);
      `;
      
      console.log('Final processed code:', finalCode.substring(0, 300) + '...');
      return finalCode;
    } catch (error) {
      console.error('Error processing code:', error);
      return '';
    }
  }, [code]);

  if (!cleanedCode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No preview available</p>
          <p className="text-xs mt-1">Code may contain syntax errors or be empty</p>
        </div>
      </div>
    );
  }

  return (
    <LiveProvider code={cleanedCode} scope={scope} noInline>
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 bg-white dark:bg-gray-950 p-4 overflow-auto rounded-t-lg border border-border">
          <ErrorBoundary>
            <LivePreview />
          </ErrorBoundary>
        </div>
        <div className="bg-red-900/20 text-red-400 text-xs p-2 rounded-b-lg font-mono max-h-24 overflow-y-auto">
          <LiveError />
        </div>
      </div>
    </LiveProvider>
  );
}
