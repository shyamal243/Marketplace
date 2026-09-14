"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "How does the booking fee work?",
    a: "A small fee applies when you post a demand. It's refunded automatically to your wallet if no seller bids on it. If you reject all bids you receive, the fee is forfeited.",
  },
  {
    q: "How do I get paid as a seller?",
    a: "When a buyer accepts your bid, an order is created. Once delivered and the buyer confirms, funds are reflected in the order. Contact support for payout details.",
  },
  {
    q: "What if my order never arrives?",
    a: "Check the tracking info on your order page first. If there's a real problem, use the 'Request a return' option on the order page, or contact support below.",
  },
  {
    q: "Can I cancel a demand after posting it?",
    a: "Yes, as long as it hasn't received any bids yet — a 'Cancel demand' button appears on the demand page, and your booking fee is refunded to your wallet.",
  },
  {
    q: "How do I become a verified seller or delivery partner?",
    a: "Go to the 'Verification' page from the menu and submit your KYC documents. An admin will review and approve or reject them.",
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold text-paper">Help &amp; support</h1>
        <p className="mt-2 font-body text-sm text-indigo-border">
          Can&apos;t find what you need? Email us at{" "}
          <a href="mailto:support@demandboard.example" className="text-marigold underline">
            support@demandboard.example
          </a>
        </p>

        <div className="mt-8 flex flex-col gap-2">
          {FAQS.map((item, i) => (
            <div key={i} className="rounded-lg bg-indigo-surface">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-body text-sm text-paper">{item.q}</span>
                <span className="font-body text-marigold">{openIndex === i ? "−" : "+"}</span>
              </button>
              {openIndex === i && (
                <p className="px-5 pb-4 font-body text-sm text-indigo-border">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
