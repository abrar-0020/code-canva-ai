// src/app/get-started/page.tsx
'use client';

import { Button } from "@/components/ui/button";

export default function GetStartedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <h1 className="text-3xl font-bold mb-4">Pricing/Sign Up (Placeholder)</h1>
      <p className="text-muted-foreground mb-6">
        Sign Up flow and detailed pricing will be implemented next week.
      </p>
      <Button onClick={() => window.location.href = '/'}>
        Start Generating Code
      </Button>
    </div>
  );
}