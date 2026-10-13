"use client";

// Submits the surrounding GET form whenever a field changes, so the page is a live calculator
// while every result stays a shareable URL.
export function AutoSubmitForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
