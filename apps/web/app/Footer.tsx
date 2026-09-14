"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-indigo-border/30 px-8 py-6 md:px-16">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
        <p className="font-body text-xs text-indigo-border">
          © {new Date().getFullYear()} Demand Board. All rights reserved.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/support" className="font-body text-xs text-indigo-border transition hover:text-marigold">
            Help &amp; FAQ
          </Link>
          <Link href="/legal/terms" className="font-body text-xs text-indigo-border transition hover:text-marigold">
            Terms
          </Link>
          <Link href="/legal/privacy" className="font-body text-xs text-indigo-border transition hover:text-marigold">
            Privacy
          </Link>
          <Link href="/legal/refund" className="font-body text-xs text-indigo-border transition hover:text-marigold">
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
