"use client";

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center">
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
              Preview Error
            </h3>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || 'Something went wrong rendering the preview.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
