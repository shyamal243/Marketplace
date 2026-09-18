"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";

interface Store {
  id: number;
  name: string;
  address: string | null;
  distanceKm: number;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  storeId: number;
}

interface ProfessionalSkillResult {
  id: number;
  skillName: string;
  category: string | null;
  hourlyRate: number;
  professionalId: number;
  professionalName: string;
}

interface PrintStore {
  id: number;
  name: string;
  address: string | null;
  distanceKm: number;
  offersPrintService: boolean;
  printPricePerPageBw: number | null;
  printPricePerPageColor: number | null;
}

type CategoryTab = "ecommerce" | "professionals" | "logistics";

const TABS: { key: CategoryTab; label: string }[] = [
  { key: "ecommerce", label: "E/Q-Commerce" },
  { key: "professionals", label: "Professionals" },
  { key: "logistics", label: "Logistics" },
];

const EQ_SUBCATEGORIES = ["food", "medicines", "electrical", "clothes", "shoes", "jewellery", "fmcg", "other"];
const PRO_SUBCATEGORIES = [
  "maid", "carpenter", "painter", "car-mechanic", "bike-mechanic", "repair",
  "massage", "spa", "haircut", "cleaning", "accountant", "tutor",
  "doctor-human", "doctor-vet", "pet-spa", "senior-care", "child-care", "driver", "other",
];
const SCHEDULE_OPTIONS = [
  { value: "instant", label: "Instant" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const VEHICLE_OPTIONS = [
  { value: "2w", label: "2W · Bike" },
  { value: "3w", label: "3W · Auto" },
  { value: "4w", label: "4W · Car/Mini-Truck" },
];
const SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const API_URL = "http://localhost:4000";

export default function BrowseStoresPage() {
  const [activeTab, setActiveTab] = useState<CategoryTab>("ecommerce");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("");
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState("");
  const [locationDenied, setLocationDenied] = useState(false);

  const [prescriptionPhoto, setPrescriptionPhoto] = useState<File | null>(null);
  const [scanningPrescription, setScanningPrescription] = useState(false);
  const [scanError, setScanError] = useState("");
  const [foundMedicines, setFoundMedicines] = useState<string[]>([]);

  const [activeProCategory, setActiveProCategory] = useState<string>("");
  const [professionalSkills, setProfessionalSkills] = useState<ProfessionalSkillResult[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [proSearch, setProSearch] = useState("");

  const [bookingSkillId, setBookingSkillId] = useState<number | null>(null);
  const [bookingSchedule, setBookingSchedule] = useState("instant");
  const [bookingHours, setBookingHours] = useState("1");
  const [bookingDate, setBookingDate] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<number | null>(null);

  const [vehicleType, setVehicleType] = useState("2w");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [dropLat, setDropLat] = useState("");
  const [dropLon, setDropLon] = useState("");
  const [dropAddress, setDropAddress] = useState("");
  const [bookingRide, setBookingRide] = useState(false);
  const [rideError, setRideError] = useState("");
  const [rideResult, setRideResult] = useState<{ orderId: number; amount: number; distanceKm: number; assignedTo: string; devRideOtp: string } | null>(null);

  const [isFreight, setIsFreight] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [sizeCategory, setSizeCategory] = useState("small");

  const [printStores, setPrintStores] = useState<PrintStore[]>([]);
  const [loadingPrintStores, setLoadingPrintStores] = useState(false);
  const [printLocationDenied, setPrintLocationDenied] = useState(false);
  const [selectedPrintStoreId, setSelectedPrintStoreId] = useState<number | null>(null);
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [printPages, setPrintPages] = useState("1");
  const [printCopies, setPrintCopies] = useState("1");
  const [printIsColor, setPrintIsColor] = useState(false);
  const [placingPrintOrder, setPlacingPrintOrder] = useState(false);
  const [printOrderError, setPrintOrderError] = useState("");
  const [printOrderSuccess, setPrintOrderSuccess] = useState<{ orderId: number; amount: number } | null>(null);

  const [rentalVehicleType, setRentalVehicleType] = useState("2w");
  const [rentalPickupCoords, setRentalPickupCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [rentalPickupAddress, setRentalPickupAddress] = useState("");
  const [locatingRentalPickup, setLocatingRentalPickup] = useState(false);
  const [rentalHours, setRentalHours] = useState("4");
  const [bookingRental, setBookingRental] = useState(false);
  const [rentalError, setRentalError] = useState("");
  const [rentalResult, setRentalResult] = useState<{ orderId: number; amount: number; assignedTo: string; devRentalStartOtp: string; devRentalEndOtp: string } | null>(null);

  function findNearbyStores() {
    setError("");
    setLoadingStores(true);
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
      setLoadingStores(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await apiFetch(
            `/stores/nearby?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&radiusKm=25`
          );
          setStores(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
          setLoadingStores(false);
        }
      },
      () => {
        setLocationDenied(true);
        setLoadingStores(false);
      }
    );
  }

  async function runProductSearch(searchVal: string, subcategory: string) {
    setError("");
    setLoadingProducts(true);
    try {
      let url = `/products/search?search=${encodeURIComponent(searchVal)}`;
      if (subcategory) url += `&category=${encodeURIComponent(subcategory)}`;
      const data = await apiFetch(url);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleProductSearch(e: React.FormEvent) {
    e.preventDefault();
    await runProductSearch(productSearch, activeSubcategory);
  }

  function handleSubcategoryClick(sub: string) {
    const next = activeSubcategory === sub ? "" : sub;
    setActiveSubcategory(next);
    setFoundMedicines([]);
    setScanError("");
    runProductSearch(productSearch, next);
  }

  async function handleScanPrescription() {
    if (!prescriptionPhoto) {
      setScanError("Attach a photo of the prescription first.");
      return;
    }
    setScanError("");
    setScanningPrescription(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("photo", prescriptionPhoto);

      const res = await fetch(`${API_URL}/products/prescription-scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not scan the prescription");

      setFoundMedicines(data.medicines || []);
      if (!data.medicines || data.medicines.length === 0) {
        setScanError("Couldn't read any medicine names from that photo — try a clearer image or search manually.");
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScanningPrescription(false);
    }
  }

  function handleMedicineChipClick(name: string) {
    setProductSearch(name);
    runProductSearch(name, "medicines");
  }

  async function runWorkerSearch(category: string, search: string) {
    setError("");
    setLoadingWorkers(true);
    try {
      let url = "/professional-skills/search?";
      if (category) url += `category=${encodeURIComponent(category)}&`;
      if (search) url += `search=${encodeURIComponent(search)}`;
      const data = await apiFetch(url);
      setProfessionalSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoadingWorkers(false);
    }
  }

  function handleProCategoryClick(cat: string) {
    const next = activeProCategory === cat ? "" : cat;
    setActiveProCategory(next);
    runWorkerSearch(next, proSearch);
  }

  function handleProSearch(e: React.FormEvent) {
    e.preventDefault();
    runWorkerSearch(activeProCategory, proSearch);
  }

  function openBookingForm(skillId: number) {
    setBookingSkillId(bookingSkillId === skillId ? null : skillId);
    setBookingSchedule("instant");
    setBookingHours("1");
    setBookingDate("");
    setBookingError("");
    setBookingSuccess(null);
  }

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBookingError("");
    setBooking(true);
    try {
      const order = await apiFetch("/service-bookings", {
        method: "POST",
        body: JSON.stringify({
          professionalSkillId: bookingSkillId,
          scheduleType: bookingSchedule,
          hoursBooked: Number(bookingHours),
          scheduledFor:
            (bookingSchedule === "today" || bookingSchedule === "tomorrow") && bookingDate
              ? new Date(bookingDate).toISOString()
              : undefined,
        }),
      });
      setBookingSuccess(order.id);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBooking(false);
    }
  }

  function handleLocatePickup() {
    setRideError("");
    setLocatingPickup(true);
    if (!navigator.geolocation) {
      setRideError("Location isn't available in this browser.");
      setLocatingPickup(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickupCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocatingPickup(false);
      },
      () => {
        setRideError("Could not get your location. Enable location access and try again.");
        setLocatingPickup(false);
      }
    );
  }

  async function handleBookRide(e: React.FormEvent) {
    e.preventDefault();
    setRideError("");

    if (!pickupCoords) {
      setRideError("Set your pickup location first.");
      return;
    }
    if (!dropLat || !dropLon) {
      setRideError("Enter drop location coordinates.");
      return;
    }
    if (isFreight && !weightKg) {
      setRideError("Enter the package weight for a freight booking.");
      return;
    }

    setBookingRide(true);
    try {
      const result = await apiFetch("/logistics-bookings", {
        method: "POST",
        body: JSON.stringify({
          vehicleType,
          pickupLatitude: pickupCoords.lat,
          pickupLongitude: pickupCoords.lon,
          pickupAddress: pickupAddress || undefined,
          dropLatitude: Number(dropLat),
          dropLongitude: Number(dropLon),
          dropAddress: dropAddress || undefined,
          isFreight,
          weightKg: isFreight ? Number(weightKg) : undefined,
          sizeCategory: isFreight ? sizeCategory : undefined,
        }),
      });
      setRideResult({
        orderId: result.id,
        amount: result.amount,
        distanceKm: result.distanceKm,
        assignedTo: result.assignedTo,
        devRideOtp: result.devRideOtp,
      });
    } catch (err) {
      setRideError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBookingRide(false);
    }
  }

  function findPrintStores() {
    setPrintOrderError("");
    setLoadingPrintStores(true);
    setPrintLocationDenied(false);

    if (!navigator.geolocation) {
      setPrintOrderError("Location isn't available in this browser.");
      setLoadingPrintStores(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await apiFetch(
            `/stores/nearby?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&radiusKm=25`
          );
          setPrintStores((data as PrintStore[]).filter((s) => s.offersPrintService));
        } catch (err) {
          setPrintOrderError(err instanceof Error ? err.message : "Failed to load");
        } finally {
          setLoadingPrintStores(false);
        }
      },
      () => {
        setPrintLocationDenied(true);
        setLoadingPrintStores(false);
      }
    );
  }

  function selectPrintStore(storeId: number) {
    setSelectedPrintStoreId(selectedPrintStoreId === storeId ? null : storeId);
    setPrintOrderSuccess(null);
    setPrintOrderError("");
  }

  async function handlePlacePrintOrder(e: React.FormEvent) {
    e.preventDefault();
    setPrintOrderError("");

    if (!printFile) {
      setPrintOrderError("Attach the document you want printed.");
      return;
    }

    setPlacingPrintOrder(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("document", printFile);
      formData.append("storeId", String(selectedPrintStoreId));
      formData.append("pages", printPages);
      formData.append("copies", printCopies);
      formData.append("isColorPrint", String(printIsColor));

      const res = await fetch(`${API_URL}/printout-orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place the print order");

      setPrintOrderSuccess({ orderId: data.id, amount: data.amount });
    } catch (err) {
      setPrintOrderError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPlacingPrintOrder(false);
    }
  }

  function handleLocateRentalPickup() {
    setRentalError("");
    setLocatingRentalPickup(true);
    if (!navigator.geolocation) {
      setRentalError("Location isn't available in this browser.");
      setLocatingRentalPickup(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRentalPickupCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocatingRentalPickup(false);
      },
      () => {
        setRentalError("Could not get your location. Enable location access and try again.");
        setLocatingRentalPickup(false);
      }
    );
  }

  async function handleBookRental(e: React.FormEvent) {
    e.preventDefault();
    setRentalError("");

    if (!rentalPickupCoords) {
      setRentalError("Set your pickup location first.");
      return;
    }
    if (!rentalHours || Number(rentalHours) <= 0) {
      setRentalError("Enter how many hours you need the vehicle for.");
      return;
    }

    setBookingRental(true);
    try {
      const result = await apiFetch("/vehicle-rentals", {
        method: "POST",
        body: JSON.stringify({
          vehicleType: rentalVehicleType,
          pickupLatitude: rentalPickupCoords.lat,
          pickupLongitude: rentalPickupCoords.lon,
          pickupAddress: rentalPickupAddress || undefined,
          rentalHours: Number(rentalHours),
        }),
      });
      setRentalResult({
        orderId: result.id,
        amount: result.amount,
        assignedTo: result.assignedTo,
        devRentalStartOtp: result.devRentalStartOtp,
        devRentalEndOtp: result.devRentalEndOtp,
      });
    } catch (err) {
      setRentalError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBookingRental(false);
    }
  }

  return (
    <div className="hex-grid-bg min-h-screen bg-rv-bg px-8 py-12 md:px-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-rv-text">Browse by category</h1>

        <div className="mt-6 flex gap-2 border-b border-rv-border pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 font-body text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-rv-magenta text-rv-bg shadow-hud-glow-magenta"
                  : "border border-rv-border text-rv-text-dim hover:hud-border hover:text-rv-cyan"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
        )}

        {activeTab === "ecommerce" && (
          <>
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-rv-text">Nearby stores</h2>
                <button
                  onClick={findNearbyStores}
                  disabled={loadingStores}
                  className="rounded-md bg-rv-magenta px-4 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                >
                  {loadingStores ? "Finding..." : "Use my location"}
                </button>
              </div>

              {locationDenied && (
                <p className="mt-3 font-body text-sm text-rv-text-dim">
                  Location access was denied. Enable it in your browser to find nearby stores.
                </p>
              )}

              {stores.length === 0 && !loadingStores && !locationDenied && (
                <p className="mt-3 font-body text-sm text-rv-text-dim">
                  Click &quot;Use my location&quot; to find stores near you.
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {stores.map((s) => (
                  <Link
                    key={s.id}
                    href={`/stores/${s.id}`}
                    className="glass-panel block px-5 py-3 transition hover:hud-border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-body text-sm text-rv-text">{s.name}</span>
                      <span className="font-body text-xs text-rv-text-dim">{s.distanceKm} km</span>
                    </div>
                    {s.address && <p className="mt-1 font-body text-xs text-rv-text-dim">{s.address}</p>}
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-rv-text">Search products</h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {EQ_SUBCATEGORIES.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSubcategoryClick(sub)}
                    className={`rounded-full border px-3 py-1.5 font-body text-xs capitalize transition ${
                      activeSubcategory === sub
                        ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                        : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40 hover:text-rv-cyan"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {activeSubcategory === "medicines" && (
                <div className="hud-border glass-panel mt-4 p-4">
                  <h3 className="font-display text-sm font-semibold text-rv-cyan">💊 Scan a prescription</h3>
                  <p className="mt-1 font-body text-xs text-rv-text-dim">
                    Upload a photo of your prescription and we&apos;ll find the medicine names for you.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPrescriptionPhoto(e.target.files?.[0] ?? null)}
                      className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleScanPrescription}
                      disabled={scanningPrescription}
                      className="rounded-md bg-rv-cyan px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
                    >
                      {scanningPrescription ? "Scanning..." : "Scan"}
                    </button>
                  </div>
                  {scanError && (
                    <p className="mt-2 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-xs text-rv-danger">
                      {scanError}
                    </p>
                  )}
                  {foundMedicines.length > 0 && (
                    <div className="mt-3">
                      <p className="font-body text-xs text-rv-text-dim">Found on your prescription — tap to search:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {foundMedicines.map((med) => (
                          <button
                            key={med}
                            type="button"
                            onClick={() => handleMedicineChipClick(med)}
                            className="rounded-full border border-rv-cyan/40 bg-rv-cyan/10 px-3 py-1 font-body text-xs text-rv-cyan transition hover:shadow-hud-glow"
                          >
                            {med}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleProductSearch} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search for a product..."
                  className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                />
                <button
                  type="submit"
                  disabled={loadingProducts}
                  className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                >
                  {loadingProducts ? "Searching..." : "Search"}
                </button>
              </form>

              <div className="mt-3 flex flex-col gap-2">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/stores/${p.storeId}`}
                    className="glass-panel block px-5 py-3 transition hover:hud-border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-body text-sm text-rv-text">{p.name}</span>
                      <span className="font-display text-sm font-semibold text-rv-magenta">₹{p.price}</span>
                    </div>
                    {p.description && <p className="mt-1 font-body text-xs text-rv-text-dim">{p.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "professionals" && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold text-rv-text">Find a professional</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {PRO_SUBCATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleProCategoryClick(cat)}
                  className={`rounded-full border px-3 py-1.5 font-body text-xs capitalize transition ${
                    activeProCategory === cat
                      ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                      : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40 hover:text-rv-cyan"
                  }`}
                >
                  {cat.replace(/-/g, " ")}
                </button>
              ))}
            </div>

            <form onSubmit={handleProSearch} className="mt-3 flex gap-2">
              <input
                type="text"
                value={proSearch}
                onChange={(e) => setProSearch(e.target.value)}
                placeholder="Search for a service..."
                className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
              />
              <button
                type="submit"
                disabled={loadingWorkers}
                className="rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {loadingWorkers ? "Searching..." : "Search"}
              </button>
            </form>

            {professionalSkills.length === 0 && !loadingWorkers && (
              <p className="mt-4 font-body text-sm text-rv-text-dim">
                Pick a category or search above to find available professionals.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2">
              {professionalSkills.map((w) => (
                <div key={w.id} className="glass-panel px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-body text-sm text-rv-text">{w.skillName}</p>
                      <p className="font-body text-xs text-rv-text-dim">by {w.professionalName}</p>
                      {w.category && (
                        <span className="mt-1 inline-block rounded-full border border-rv-cyan/30 bg-rv-cyan/10 px-2 py-0.5 font-body text-xs text-rv-cyan capitalize">
                          {w.category.replace(/-/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap font-display text-sm font-semibold text-rv-magenta">
                        ₹{w.hourlyRate}/hr
                      </span>
                      <button
                        onClick={() => openBookingForm(w.id)}
                        className="rounded-md border border-rv-cyan/40 px-3 py-1.5 font-body text-xs text-rv-cyan transition hover:hud-border"
                      >
                        {bookingSkillId === w.id ? "Cancel" : "Book"}
                      </button>
                    </div>
                  </div>

                  {bookingSkillId === w.id && (
                    <form onSubmit={handleBookingSubmit} className="hud-border mt-3 rounded-md p-4">
                      {bookingSuccess ? (
                        <div>
                          <p className="font-body text-sm text-rv-cyan">Booking confirmed!</p>
                          <Link
                            href={`/orders/${bookingSuccess}`}
                            className="mt-2 inline-block font-body text-xs text-rv-cyan underline"
                          >
                            View booking →
                          </Link>
                        </div>
                      ) : (
                        <>
                          <span className="font-body text-xs font-medium text-rv-text-dim">Schedule</span>
                          <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {SCHEDULE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setBookingSchedule(opt.value)}
                                className={`rounded-md border px-2 py-1.5 font-body text-xs transition ${
                                  bookingSchedule === opt.value
                                    ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                                    : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {(bookingSchedule === "today" || bookingSchedule === "tomorrow") && (
                            <div className="mt-3">
                              <label className="font-body text-xs font-medium text-rv-text-dim">Preferred time</label>
                              <input
                                type="datetime-local"
                                value={bookingDate}
                                onChange={(e) => setBookingDate(e.target.value)}
                                className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                              />
                            </div>
                          )}

                          <div className="mt-3">
                            <label className="font-body text-xs font-medium text-rv-text-dim">Hours needed</label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={bookingHours}
                              onChange={(e) => setBookingHours(e.target.value)}
                              className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                            />
                          </div>

                          <p className="mt-3 font-body text-xs text-rv-text-dim">
                            Estimated total:{" "}
                            <span className="text-rv-magenta">
                              ₹{w.hourlyRate * Number(bookingHours || 0)}
                            </span>
                          </p>

                          {bookingError && (
                            <p className="mt-2 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-xs text-rv-danger">
                              {bookingError}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={booking}
                            className="mt-3 w-full rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                          >
                            {booking ? "Booking..." : "Confirm booking"}
                          </button>
                        </>
                      )}
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "logistics" && (
          <>
            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-rv-text">Book a ride or delivery</h2>

              {rideResult ? (
                <div className="hud-border glass-panel mt-4 p-6">
                  <p className="font-display text-lg font-semibold text-rv-cyan">Booking confirmed!</p>
                  <p className="mt-2 font-body text-sm text-rv-text">
                    Distance: {rideResult.distanceKm} km · Fare: <span className="text-rv-magenta">₹{rideResult.amount}</span>
                  </p>
                  <p className="mt-1 font-body text-sm text-rv-text-dim">Assigned to: {rideResult.assignedTo}</p>
                  <div className="mt-3 rounded-md border border-rv-magenta/40 bg-rv-magenta/10 px-3 py-2">
                    <p className="font-body text-xs text-rv-text-dim">Show this code to your driver/rider to start the trip:</p>
                    <p className="mt-1 font-display text-xl font-semibold tracking-widest text-rv-magenta">{rideResult.devRideOtp}</p>
                  </div>
                  <Link
                    href={`/orders/${rideResult.orderId}`}
                    className="mt-3 inline-block font-body text-xs text-rv-cyan underline"
                  >
                    View booking →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleBookRide} className="glass-panel mt-4 p-6">
                  <span className="font-body text-sm font-medium text-rv-text">Vehicle type</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {VEHICLE_OPTIONS.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVehicleType(v.value)}
                        className={`rounded-md border px-2 py-2 font-body text-xs transition ${
                          vehicleType === v.value
                            ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                            : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <span className="font-body text-sm font-medium text-rv-text">Pickup location</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLocatePickup}
                        disabled={locatingPickup}
                        className="rounded-md border border-rv-cyan/40 px-3 py-2 font-body text-xs text-rv-cyan transition hover:hud-border disabled:opacity-60"
                      >
                        {locatingPickup ? "Locating..." : pickupCoords ? "Pickup set ✓" : "Use my location"}
                      </button>
                      <input
                        type="text"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="Pickup note (optional, e.g. Gate 2)"
                        className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="font-body text-sm font-medium text-rv-text">Drop location</span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        required
                        value={dropLat}
                        onChange={(e) => setDropLat(e.target.value)}
                        placeholder="Latitude"
                        className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                      <input
                        type="number"
                        step="any"
                        required
                        value={dropLon}
                        onChange={(e) => setDropLon(e.target.value)}
                        placeholder="Longitude"
                        className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                    </div>
                    <input
                      type="text"
                      value={dropAddress}
                      onChange={(e) => setDropAddress(e.target.value)}
                      placeholder="Drop note (optional, e.g. Building name)"
                      className="mt-2 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                    />
                    <p className="mt-1 font-body text-xs text-rv-text-dim">
                      Tip: right-click a location on Google Maps to copy its coordinates.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-md border border-rv-border bg-rv-panel px-3 py-2">
                    <span className="font-body text-sm text-rv-text">This is a freight/cargo delivery</span>
                    <button
                      type="button"
                      onClick={() => setIsFreight(!isFreight)}
                      className={`rounded-full px-3 py-1 font-body text-xs transition ${
                        isFreight
                          ? "bg-rv-cyan text-rv-bg shadow-hud-glow"
                          : "border border-rv-border text-rv-text-dim"
                      }`}
                    >
                      {isFreight ? "Yes" : "No"}
                    </button>
                  </div>

                  {isFreight && (
                    <div className="mt-3 rounded-md border border-rv-cyan/30 bg-rv-cyan/10 p-3">
                      <label className="font-body text-xs font-medium text-rv-text-dim">Weight (kg)</label>
                      <input
                        type="number"
                        min={0.1}
                        step="any"
                        required={isFreight}
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        placeholder="e.g. 15"
                        className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                      <label className="mt-3 block font-body text-xs font-medium text-rv-text-dim">Size</label>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {SIZE_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setSizeCategory(s.value)}
                            className={`rounded-md border px-2 py-1.5 font-body text-xs transition ${
                              sizeCategory === s.value
                                ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                                : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {rideError && (
                    <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                      {rideError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={bookingRide}
                    className="mt-4 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                  >
                    {bookingRide ? "Booking..." : "Book now"}
                  </button>
                </form>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-rv-text">Hourly / outstation rental</h2>
              <p className="mt-1 font-body text-xs text-rv-text-dim">
                Book a driver and vehicle for a set number of hours — like Ola/Rapido rentals.
              </p>

              {rentalResult ? (
                <div className="hud-border glass-panel mt-4 p-6">
                  <p className="font-display text-lg font-semibold text-rv-cyan">Rental confirmed!</p>
                  <p className="mt-2 font-body text-sm text-rv-text">
                    Total: <span className="text-rv-magenta">₹{rentalResult.amount}</span>
                  </p>
                  <p className="mt-1 font-body text-sm text-rv-text-dim">Driver: {rentalResult.assignedTo}</p>
                  <div className="mt-3 rounded-md border border-rv-magenta/40 bg-rv-magenta/10 px-3 py-2">
                    <p className="font-body text-xs text-rv-text-dim">Give this code when the rental starts:</p>
                    <p className="mt-1 font-display text-xl font-semibold tracking-widest text-rv-magenta">{rentalResult.devRentalStartOtp}</p>
                  </div>
                  <div className="mt-2 rounded-md border border-rv-cyan/40 bg-rv-cyan/10 px-3 py-2">
                    <p className="font-body text-xs text-rv-text-dim">Give this code when you return the vehicle:</p>
                    <p className="mt-1 font-display text-xl font-semibold tracking-widest text-rv-cyan">{rentalResult.devRentalEndOtp}</p>
                  </div>
                  <Link
                    href={`/orders/${rentalResult.orderId}`}
                    className="mt-3 inline-block font-body text-xs text-rv-cyan underline"
                  >
                    View rental →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleBookRental} className="glass-panel mt-4 p-6">
                  <span className="font-body text-sm font-medium text-rv-text">Vehicle type</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {VEHICLE_OPTIONS.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setRentalVehicleType(v.value)}
                        className={`rounded-md border px-2 py-2 font-body text-xs transition ${
                          rentalVehicleType === v.value
                            ? "border-rv-cyan bg-rv-cyan/10 text-rv-cyan shadow-hud-glow"
                            : "border-rv-border text-rv-text-dim hover:border-rv-cyan/40"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <span className="font-body text-sm font-medium text-rv-text">Pickup location</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLocateRentalPickup}
                        disabled={locatingRentalPickup}
                        className="rounded-md border border-rv-cyan/40 px-3 py-2 font-body text-xs text-rv-cyan transition hover:hud-border disabled:opacity-60"
                      >
                        {locatingRentalPickup ? "Locating..." : rentalPickupCoords ? "Pickup set ✓" : "Use my location"}
                      </button>
                      <input
                        type="text"
                        value={rentalPickupAddress}
                        onChange={(e) => setRentalPickupAddress(e.target.value)}
                        placeholder="Pickup note (optional)"
                        className="flex-1 rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="font-body text-sm font-medium text-rv-text">Rental duration (hours)</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={rentalHours}
                      onChange={(e) => setRentalHours(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                    />
                  </div>

                  {rentalError && (
                    <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                      {rentalError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={bookingRental}
                    className="mt-4 w-full rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                  >
                    {bookingRental ? "Booking..." : "Book rental"}
                  </button>
                </form>
              )}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-rv-text">Print &amp; document delivery</h2>

              <button
                type="button"
                onClick={findPrintStores}
                disabled={loadingPrintStores}
                className="mt-3 rounded-md bg-rv-magenta px-4 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
              >
                {loadingPrintStores ? "Finding..." : "Find nearby print shops"}
              </button>

              {printLocationDenied && (
                <p className="mt-3 font-body text-sm text-rv-text-dim">
                  Location access was denied. Enable it in your browser to find nearby print shops.
                </p>
              )}

              {printOrderError && (
                <p className="mt-3 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
                  {printOrderError}
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {printStores.map((s) => (
                  <div key={s.id} className="glass-panel px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-body text-sm text-rv-text">{s.name}</p>
                        <p className="font-body text-xs text-rv-text-dim">
                          {s.distanceKm} km
                          {s.printPricePerPageBw && ` · B&W ₹${s.printPricePerPageBw}/pg`}
                          {s.printPricePerPageColor && ` · Color ₹${s.printPricePerPageColor}/pg`}
                        </p>
                      </div>
                      <button
                        onClick={() => selectPrintStore(s.id)}
                        className="rounded-md border border-rv-cyan/40 px-3 py-1.5 font-body text-xs text-rv-cyan transition hover:hud-border"
                      >
                        {selectedPrintStoreId === s.id ? "Cancel" : "Select"}
                      </button>
                    </div>

                    {selectedPrintStoreId === s.id && (
                      <div className="hud-border mt-3 rounded-md p-4">
                        {printOrderSuccess ? (
                          <div>
                            <p className="font-body text-sm text-rv-cyan">
                              Print order placed! Total: <span className="text-rv-magenta">₹{printOrderSuccess.amount}</span>
                            </p>
                            <Link
                              href={`/orders/${printOrderSuccess.orderId}`}
                              className="mt-2 inline-block font-body text-xs text-rv-cyan underline"
                            >
                              View order →
                            </Link>
                          </div>
                        ) : (
                          <form onSubmit={handlePlacePrintOrder}>
                            <label className="font-body text-xs font-medium text-rv-text-dim">Document</label>
                            <input
                              type="file"
                              onChange={(e) => setPrintFile(e.target.files?.[0] ?? null)}
                              className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none"
                            />
                            <p className="mt-1 font-body text-xs text-rv-text-dim">
                              Only visible to you and this store — never downloadable, and deleted automatically once printed.
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <label className="font-body text-xs font-medium text-rv-text-dim">Pages</label>
                                <input
                                  type="number"
                                  min={1}
                                  required
                                  value={printPages}
                                  onChange={(e) => setPrintPages(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                                />
                              </div>
                              <div>
                                <label className="font-body text-xs font-medium text-rv-text-dim">Copies</label>
                                <input
                                  type="number"
                                  min={1}
                                  required
                                  value={printCopies}
                                  onChange={(e) => setPrintCopies(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between rounded-md border border-rv-border bg-rv-panel px-3 py-2">
                              <span className="font-body text-sm text-rv-text">Color print</span>
                              <button
                                type="button"
                                onClick={() => setPrintIsColor(!printIsColor)}
                                className={`rounded-full px-3 py-1 font-body text-xs transition ${
                                  printIsColor
                                    ? "bg-rv-cyan text-rv-bg shadow-hud-glow"
                                    : "border border-rv-border text-rv-text-dim"
                                }`}
                              >
                                {printIsColor ? "Yes" : "No (B&W)"}
                              </button>
                            </div>

                            <button
                              type="submit"
                              disabled={placingPrintOrder}
                              className="mt-3 w-full rounded-md bg-rv-magenta px-4 py-2 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                            >
                              {placingPrintOrder ? "Placing order..." : "Place print order"}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}