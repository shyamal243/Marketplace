export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl font-body text-sm leading-relaxed text-indigo-border">
        <h1 className="font-display text-3xl font-semibold text-paper">Refund &amp; Return Policy</h1>
        <p className="mt-2 text-xs text-marigold">
          Draft template — have a qualified lawyer review this before going live.
        </p>
        <p className="mt-6">Last updated: [DATE]</p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">1. Booking fee</h2>
        <p className="mt-2">
          The booking fee paid when posting a demand is non-refundable, except:
          it is automatically refunded to your wallet if your demand receives zero
          bids within its bidding window.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">2. Order cancellation</h2>
        <p className="mt-2">
          A confirmed order can be cancelled by either the buyer or seller before it
          ships. If the order was already paid, the amount is refunded to your wallet.
          Once an order has shipped, it cannot be cancelled — see Returns below instead.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">3. Returns</h2>
        <p className="mt-2">
          After delivery, you may request a return with a reason through your order page.
          The seller (or our platform team) will review your request. If approved, the
          order amount is refunded to your wallet and the order is cancelled.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">4. Wallet refunds</h2>
        <p className="mt-2">
          Refunds are credited to your platform wallet, not your original payment method.
          Wallet balance can be used for future orders on the platform.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">5. Disputes</h2>
        <p className="mt-2">
          If a seller does not respond to a return request within a reasonable time,
          contact us at [SUPPORT EMAIL] and our team will review the case.
        </p>
      </div>
    </div>
  );
}
