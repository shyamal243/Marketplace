export default function TermsPage() {
  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl font-body text-sm leading-relaxed text-indigo-border">
        <h1 className="font-display text-3xl font-semibold text-paper">Terms of Service</h1>
        <p className="mt-2 text-xs text-marigold">
          Draft template — have a qualified lawyer review this before going live.
        </p>
        <p className="mt-6">Last updated: [DATE]</p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">1. Who we are</h2>
        <p className="mt-2">
          Demand Board (&quot;we&quot;, &quot;us&quot;) operates an online marketplace connecting
          buyers with sellers, service workers, and delivery partners in India.
          By using this platform, you agree to these Terms.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">2. Accounts</h2>
        <p className="mt-2">
          You must provide accurate information when creating an account. You are responsible
          for keeping your login credentials secure. You must be at least 18 years old to use
          this platform.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">3. How the marketplace works</h2>
        <p className="mt-2">
          Buyers post demands describing what they need. Sellers and workers submit bids.
          A buyer accepting a bid creates a binding order between the buyer and that
          seller/worker. We facilitate this connection and payment processing but are not
          a party to the underlying transaction between buyer and seller.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">4. Fees</h2>
        <p className="mt-2">
          A booking fee applies when posting a demand, as shown at the time of posting.
          This fee is non-refundable except where a demand receives zero bids (auto-refunded)
          as described in our platform policies. We may also charge sellers a commission
          on completed orders, disclosed at checkout.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">5. Payments</h2>
        <p className="mt-2">
          Payments are processed via Razorpay. We do not store your card or bank details.
          Wallet balances held on the platform are for use within the platform only.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">6. Prohibited conduct</h2>
        <p className="mt-2">
          You may not use the platform for illegal goods or services, fraud, harassment,
          or to circumvent platform fees by arranging payment outside the platform for
          a deal originated here.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">7. Limitation of liability</h2>
        <p className="mt-2">
          We are not liable for the quality, safety, or legality of items or services
          exchanged between users. Disputes between buyers and sellers should first be
          resolved through our returns process; we may assist but are not obligated to
          resolve every dispute.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">8. Changes to these terms</h2>
        <p className="mt-2">
          We may update these Terms from time to time. Continued use of the platform
          after changes means you accept the updated Terms.
        </p>

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">9. Contact</h2>
        <p className="mt-2">Questions about these Terms: [SUPPORT EMAIL]</p>
      </div>
    </div>
  );
}
