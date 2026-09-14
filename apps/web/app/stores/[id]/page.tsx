"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

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

export default function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    loadProducts();
  }, [id]);

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
          description: description || undefined,
          price: Number(price),
          stock: Number(stock) || 0,
        }),
      });
      setName("");
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

  const isCustomer = user && user.role !== "seller";
  const isOwner = user?.role === "seller";

  return (
    <div className="min-h-screen bg-indigo-deep px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-paper">Store #{id}</h1>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Link
                href={`/stores/${id}/analytics`}
                className="rounded-md border border-indigo-border/60 px-3 py-1.5 font-body text-sm text-paper transition hover:border-marigold hover:text-marigold"
              >
                Analytics
              </Link>
            )}
            {user && (
              <button
                onClick={handleFavorite}
                disabled={favorited}
                className="rounded-md border border-marigold/50 px-3 py-1.5 font-body text-sm text-marigold transition hover:bg-marigold/10 disabled:opacity-60"
              >
                {favorited ? "Favorited" : "+ Favorite"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 font-body text-sm text-red-300">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-md bg-marigold/10 px-4 py-3 font-body text-sm text-marigold">{message}</p>
        )}

        {user?.role === "seller" && (
          <form onSubmit={handleAddProduct} className="mt-6 rounded-lg bg-paper p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Add a product</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name"
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price (Rs.)"
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Stock"
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-body text-ink outline-none focus:border-marigold focus:ring-2 focus:ring-marigold/30"
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="rounded-md bg-indigo-deep px-4 py-2.5 font-body font-medium text-paper transition hover:bg-indigo-surface disabled:opacity-60"
              >
                {adding ? "Adding..." : "Add product"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-paper">Products</h2>
          {loading ? (
            <p className="mt-3 font-body text-sm text-indigo-border">Loading...</p>
          ) : products.length === 0 ? (
            <p className="mt-3 font-body text-sm text-indigo-border">No products yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {products.map((p) => (
                <div key={p.id} className="rounded-lg bg-indigo-surface p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-base font-semibold text-paper">{p.name}</h3>
                      {p.description && (
                        <p className="mt-1 font-body text-sm text-indigo-border">{p.description}</p>
                      )}
                      <p className="mt-1 font-body text-xs text-indigo-border">Stock: {p.stock}</p>
                    </div>
                    <span className="whitespace-nowrap font-display text-lg font-semibold text-marigold">
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
                        className="w-20 rounded-md border border-indigo-border/40 bg-indigo-deep px-2 py-1.5 font-body text-sm text-paper outline-none focus:border-marigold"
                      />
                      <span className="font-body text-xs text-indigo-border">quantity to order</span>
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
            className="mt-6 w-full rounded-md bg-marigold px-4 py-2.5 font-body font-medium text-indigo-deep transition hover:opacity-90"
          >
            Place order
          </button>
        )}
      </div>
    </div>
  );
}