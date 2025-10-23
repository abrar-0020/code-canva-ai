// src/app/pricing/page.tsx
export default function PricingPage() {
  return (
    <div className="container mx-auto p-8 max-w-2xl min-h-screen bg-background">
      <h1 className="text-3xl font-bold mb-6">Pricing Plans</h1>
      <p className="text-lg text-primary mb-4">
        **MVP Offer:** Unlimited access during launch week!
      </p>
      <ul className="list-disc ml-6 space-y-2 text-muted-foreground">
        <li>**Free Tier:** 5 Generations/Day (Post-Launch)</li>
        <li>**Pro Tier:** Unlimited Generations, Priority Support, Commercial Rights (Coming Soon)</li>
      </ul>
    </div>
  );
}