"use client";

import { useEffect, useState, use } from "react";
import { apiFetch } from "../../../lib/api";

interface InvoiceItem {
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  gstRatePercent: number;
  gstAmount: number;
}

interface InvoiceData {
  orderId: number;
  orderType: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  isSimple: boolean;
  items?: InvoiceItem[];
  subtotal?: number;
  totalGst?: number;
  grandTotal: number;
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvoice();
  }, [id]);

  async function loadInvoice() {
    setLoading(true);
    try {
      const data = await apiFetch(`/orders/${id}/invoice-data`);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-rv-bg px-8 py-12 text-rv-text md:px-16">Loading...</div>;
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-rv-bg px-8 py-12 md:px-16">
        <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
          {error || "Invoice not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rv-bg px-8 py-12 print:bg-white md:px-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <h1 className="font-display text-2xl font-semibold text-rv-text">Invoice</h1>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="glass-panel p-8 print:border print:border-gray-300 print:bg-white print:shadow-none">
          <div className="flex items-start justify-between border-b border-rv-border pb-4 print:border-gray-300">
            <div>
              <p className="font-display text-xl font-semibold text-rv-text print:text-black">Demand Board</p>
              <p className="mt-1 font-body text-xs text-rv-text-dim print:text-gray-600">Tax Invoice</p>
            </div>
            <div className="text-right">
              <p className="font-body text-sm text-rv-text print:text-black">Order #{invoice.orderId}</p>
              <p className="font-body text-xs text-rv-text-dim print:text-gray-600">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Billed to</p>
              <p className="mt-1 font-body text-sm text-rv-text print:text-black">{invoice.buyerName}</p>
              <p className="font-body text-xs text-rv-text-dim print:text-gray-600">{invoice.buyerEmail}</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Sold by</p>
              <p className="mt-1 font-body text-sm text-rv-text print:text-black">{invoice.sellerName}</p>
              <p className="font-body text-xs text-rv-text-dim print:text-gray-600">{invoice.sellerEmail}</p>
            </div>
          </div>

          {invoice.isSimple ? (
            <div className="mt-8">
              <div className="flex items-center justify-between border-t border-rv-border py-3 print:border-gray-300">
                <span className="font-body text-sm text-rv-text-dim print:text-gray-600 capitalize">
                  {invoice.orderType.replace(/_/g, " ")}
                </span>
                <span className="font-display text-lg font-semibold text-rv-text print:text-black">
                  ₹{invoice.grandTotal}
                </span>
              </div>
              <p className="mt-2 font-body text-xs text-rv-text-dim print:text-gray-500">
                GST breakdown is only available for store orders with individually categorized products.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rv-border text-left print:border-gray-300">
                    <th className="pb-2 font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Item</th>
                    <th className="pb-2 text-right font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Qty</th>
                    <th className="pb-2 text-right font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Price</th>
                    <th className="pb-2 text-right font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">GST</th>
                    <th className="pb-2 text-right font-body text-xs uppercase tracking-wide text-rv-text-dim print:text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, idx) => (
                    <tr key={idx} className="border-b border-rv-border/30 print:border-gray-200">
                      <td className="py-2 font-body text-sm text-rv-text print:text-black">
                        {item.name}
                        <span className="ml-1 font-body text-xs text-rv-text-dim print:text-gray-500 capitalize">
                          ({item.category})
                        </span>
                      </td>
                      <td className="py-2 text-right font-body text-sm text-rv-text print:text-black">{item.quantity}</td>
                      <td className="py-2 text-right font-body text-sm text-rv-text print:text-black">₹{item.unitPrice}</td>
                      <td className="py-2 text-right font-body text-sm text-rv-text-dim print:text-gray-600">
                        {item.gstRatePercent}% (₹{item.gstAmount.toFixed(2)})
                      </td>
                      <td className="py-2 text-right font-body text-sm text-rv-text print:text-black">
                        ₹{(item.lineTotal + item.gstAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex flex-col items-end gap-1">
                <div className="flex w-48 justify-between font-body text-sm text-rv-text-dim print:text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{invoice.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex w-48 justify-between font-body text-sm text-rv-text-dim print:text-gray-600">
                  <span>Total GST</span>
                  <span>₹{invoice.totalGst?.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex w-48 justify-between border-t border-rv-border pt-1 font-display text-base font-semibold text-rv-text print:border-gray-300 print:text-black">
                  <span>Grand Total</span>
                  <span>₹{invoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}