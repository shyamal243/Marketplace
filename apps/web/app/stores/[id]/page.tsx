"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

const EQ_CATEGORIES = ["food", "medicines", "electrical", "clothes", "shoes", "jewellery", "fmcg", "other"];

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
}

interface User {
  id: number;
  role: string;
}

interface CoSupplier {
  accessId: number;
  userId: number;
  name: string;
  email: string;
}

export default function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [favorited, setFavorited] = useState(false);

  const [offersPrint, setOffersPrint] = useState(false);
  const [printBw, setPrintBw] = useState("");
  const [printColor, setPrintColor] = useState("");
  const [savingPrintSettings, setSavingPrintSettings] = useState(false);

  const [coSuppliers, setCoSuppliers] = useState<CoSupplier[]>([]);
  const [loadingCoSuppliers, setLoadingCoSuppliers] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assigningCoSupplier, setAssigningCoSupplier] = useState(false);
  const [coSupplierError, setCoSupplierError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
  }, [id]);

  useEffect(() => {
    if (user?.role === "seller") {
      loadCoSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await apiFetch(`/stores/${id}/products`);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function loadCoSuppliers() {
    setLoadingCoSuppliers(true);
    try {
      const data = await apiFetch(`/stores/${id}/co-suppliers`);
      setCoSuppliers(data);
    } catch {
      // silently ignore if not the owner or something goes wrong loading this
    } finally {
      setLoadingCoSuppliers(false);
    }
  }

  async function handleAssignCoSupplier(e: React.FormEvent) {
    e.preventDefault();
    setCoSupplierError("");
    setAssigningCoSupplier(true);
    try {
      await apiFetch(`/stores/${id}/assign-co-supplier`, {
        method: "POST",
        body: JSON.stringify({ email: assignEmail }),
      });
      setAssignEmail("");
      await loadCoSuppliers();
    } catch (err) {
      setCoSupplierError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAssigningCoSupplier(false);
    }
  }

  async function handleRemoveCoSupplier(userId: number) {
    setCoSupplierError("");
    try {
      await apiFetch(`/stores/${id}/remove-co-supplier`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadCoSuppliers();
    } catch (err) {
      setCoSupplierError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          storeId: Number(id),
          name,
          category: category || undefined,
          description: description || undefined,
          price: Number(price),
          stock: Number(stock) || 0,
        }),
      });
      setName("");
      setCategory("");
      setDescription("");
      setPrice("");
      setStock("");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  function updateCart(productId: number, quantity: number) {
    setCart((prev) => ({ ...prev, [productId]: quantity }));
  }

  async function handleCheckout() {
    setError("");
    setMessage("");
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }));

    if (items.length === 0) {
      setError("Add at least one item to your order.");
      return;
    }

    try {
      const order = await apiFetch("/store-orders", {
        method: "POST",
        body: JSON.stringify({ storeId: Number(id), items }),
      });
      setMessage(`Order placed! Order #${order.id} - Total Rs.${order.totalAmount}`);
      setCart({});
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleFavorite() {
    setError("");
    try {
      await apiFetch("/favorites", {
        method: "POST",
        body: JSON.stringify({ storeId: Number(id) }),
      });
      setFavorited(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleSavePrintSettings(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSavingPrintSettings(true);
    try {
      await apiFetch(`/stores/${id}/print-settings`, {
        method: "POST",
        body: JSON.stringify({
          offersPrintService: offersPrint,
          printPricePerPageBw: printBw ? Number(printBw) : undefined,
          printPricePerPageColor: printColor ? Number(printColor) : undefined,
        }),
      });
      setMessage("Print settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingPrintSettings(false);
    }
  }

  const isCustomer = user && user.role !== "seller" && user.role !== "co_supplier";
  const isManager = user?.role === "seller" || user?.role === "co_supplier";
  const isTrueSeller = user?.role === "seller";

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-rv-text">Store #{id}</h1>
          <div className="flex items-center gap-2">
            {isManager && (
              <Link
                href={`/stores/${id}/analytics`}
                className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
              >
                Analytics
              </Link>
            )}
            {user && (
              <button
                onClick={handleFavorite}
                disabled={favorited}
                className="rounded-md border border-rv-magenta/50 px-3 py-1.5 font-body text-sm text-rv-magenta transition hover:bg-rv-magenta/10 disabled:opacity-60"
              >
                {favorited ? "Favorited" : "+ Favorite"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-4 py-3 font-body text-sm text-rv-cyan">{message}</p>
        )}

        {isManager && (
          <form onSubmit={handleAddProduct} className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Add a product</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              >
                <option value="">Select a category (optional)</option>
                {EQ_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price (Rs.)"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Stock"
                  className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {adding ? "Adding..." : "Add product"}
              </button>
            </div>
          </form>
        )}

        {isManager && (
          <form onSubmit={handleSavePrintSettings} className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Print service settings</h2>
            <div className="mt-4 flex items-center justify-between rounded-md border border-rv-border bg-rv-panel px-3 py-2">
              <span className="font-body text-sm text-rv-text">Offer print service at this store</span>
              <button
                type="button"
                onClick={() => setOffersPrint(!offersPrint)}
                className={`rounded-full px-3 py-1 font-body text-xs transition ${
                  offersPrint
                    ? "bg-rv-cyan text-rv-bg shadow-hud-glow"
                    : "border border-rv-border text-rv-text-dim"
                }`}
              >
                {offersPrint ? "On" : "Off"}
              </button>
            </div>
            {offersPrint && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-xs font-medium text-rv-text-dim">B&amp;W price/page</label>
                  <input
                    type="number"
                    min={1}
                    value={printBw}
                    onChange={(e) => setPrintBw(e.target.value)}
                    placeholder="e.g. 2"
                    className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                  />
                </div>
                <div>
                  <label className="font-body text-xs font-medium text-rv-text-dim">Color price/page</label>
                  <input
                    type="number"
                    min={1}
                    value={printColor}
                    onChange={(e) => setPrintColor(e.target.value)}
                    placeholder="e.g. 8"
                    className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={savingPrintSettings}
              className="mt-4 rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
            >
              {savingPrintSettings ? "Saving..." : "Save print settings"}
            </button>
          </form>
        )}

        {isTrueSeller && (
          <div className="glass-panel mt-6 p-6">
            <h2 className="font-display text-lg font-semibold text-rv-text">Manage co-suppliers</h2>
            <p className="mt-1 font-body text-xs text-rv-text-dim">
              Give another registered user full management access to this store only.
            </p>

            <form onSubmit={handleAssignCoSupplier} className="mt-4 flex gap-2">
              <input
                type="email"
                required
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                placeholder="Their email address"
                className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <button
                type="submit"
                disabled={assigningCoSupplier}
                className="rounded-md bg-rv-cyan px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
              >
                {assigningCoSupplier ? "Adding..." : "Grant access"}
              </button>
            </form>

            {coSupplierError && (
              <p className="mt-2 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-xs text-rv-danger">
                {coSupplierError}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {loadingCoSuppliers ? (
                <p className="font-body text-xs text-rv-text-dim">Loading...</p>
              ) : coSuppliers.length === 0 ? (
                <p className="font-body text-xs text-rv-text-dim">No co-suppliers assigned to this store yet.</p>
              ) : (
                coSuppliers.map((cs) => (
                  <div key={cs.accessId} className="flex items-center justify-between rounded-md border border-rv-border bg-rv-panel px-3 py-2">
                    <span className="font-body text-xs text-rv-text">{cs.name} · {cs.email}</span>
                    <button
                      onClick={() => handleRemoveCoSupplier(cs.userId)}
                      className="font-body text-xs text-rv-text-dim underline hover:text-rv-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-rv-text">Products</h2>
          {loading ? (
            <p className="mt-3 font-body text-sm text-rv-text-dim">Loading...</p>
          ) : products.length === 0 ? (
            <p className="mt-3 font-body text-sm text-rv-text-dim">No products yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {products.map((p) => (
                <div key={p.id} className="glass-panel p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-base font-semibold text-rv-text">{p.name}</h3>
                      {p.description && (
                        <p className="mt-1 font-body text-sm text-rv-text-dim">{p.description}</p>
                      )}
                      <p className="mt-1 font-body text-xs text-rv-text-dim">Stock: {p.stock}</p>
                    </div>
                    <span className="whitespace-nowrap font-display text-lg font-semibold text-rv-magenta">
                      Rs.{p.price}
                    </span>
                  </div>
                  {isCustomer && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={p.stock}
                        value={cart[p.id] ?? ""}
                        onChange={(e) => updateCart(p.id, Number(e.target.value))}
                        placeholder="Qty"
                        className="w-20 rounded-md border border-rv-border bg-rv-bg px-2 py-1.5 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                      <span className="font-body text-xs text-rv-text-dim">quantity to order</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isCustomer && products.length > 0 && (
          <button
            onClick={handleCheckout}
            className="mt-6 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
          >
            Place order
          </button>
        )}
      </div>
    </div>
  );
}