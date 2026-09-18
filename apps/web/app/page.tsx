"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "./lib/api";

interface User {
  id: number;
  name: string;
  role: string;
}

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

type LandingTab = "postdemand" | "ecommerce" | "professionals" | "logistics";

const LANDING_TABS: { key: LandingTab; label: string }[] = [
  { key: "postdemand", label: "Post a Demand" },
  { key: "ecommerce", label: "E/Q-Commerce" },
  { key: "professionals", label: "Professionals" },
  { key: "logistics", label: "Logistics" },
];

const DURATIONS = [1, 2, 3, 6, 12, 24];
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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<LandingTab>("postdemand");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  const [demandTitle, setDemandTitle] = useState("");
  const [demandDescription, setDemandDescription] = useState("");
  const [demandBudget, setDemandBudget] = useState("");
  const [demandCategory, setDemandCategory] = useState("");
  const [demandHoursNeeded, setDemandHoursNeeded] = useState("");
  const [demandDurationHours, setDemandDurationHours] = useState(2);
  const [demandError, setDemandError] = useState("");
  const [submittingDemand, setSubmittingDemand] = useState(false);
  const [demandPosted, setDemandPosted] = useState<number | null>(null);

  const [aiText, setAiText] = useState("");
  const [aiPhoto, setAiPhoto] = useState<File | null>(null);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDrafted, setAiDrafted] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micError, setMicError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [activeSubcategory, setActiveSubcategory] = useState<string>("");
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch {
      // even if this fails, still clear local session
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  }

  async function startRecording() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setMicError("Microphone access was denied or isn't available in this browser.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function clearRecording() {
    setAudioBlob(null);
  }

  async function handleAiDraft(e: React.FormEvent) {
    e.preventDefault();
    setAiError("");

    if (!aiText && !aiPhoto && !audioBlob) {
      setAiError("Type something, add a photo, or record a voice note first.");
      return;
    }

    setAiDrafting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      if (aiText) formData.append("text", aiText);
      if (aiPhoto) formData.append("photo", aiPhoto);
      if (audioBlob) formData.append("audio", audioBlob, "voice-note.webm");

      const res = await fetch(`${API_URL}/demands/ai-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not draft this demand");

      setDemandTitle(data.title || "");
      setDemandDescription(data.description || "");
      setDemandCategory(data.category || "");
      setDemandBudget(data.budget ? String(data.budget) : "");
      setDemandHoursNeeded(data.hoursNeeded ? String(data.hoursNeeded) : "");
      setAiDrafted(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiDrafting(false);
    }
  }

  async function handleDemandSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDemandError("");
    setSubmittingDemand(true);

    try {
      const demand = await apiFetch("/demands", {
        method: "POST",
        body: JSON.stringify({
          title: demandTitle,
          description: demandDescription || undefined,
          budget: demandBudget ? Number(demandBudget) : undefined,
          category: demandCategory || undefined,
          hoursNeeded: demandHoursNeeded ? Number(demandHoursNeeded) : undefined,
          durationHours: demandDurationHours,
        }),
      });
      setDemandPosted(demand.id);
    } catch (err) {
      setDemandError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmittingDemand(false);
    }
  }

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
    <div className="min-h-screen bg-rv-bg hex-grid-bg">
      <header className="relative flex items-center justify-between border-b border-rv-border px-8 py-5 md:px-16 glass-panel rounded-none hud-scanline">
        <span className="font-display text-xl font-semibold text-rv-cyan tracking-widest">
          DEMAND//BOARD
        </span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md border border-rv-border p-2 font-body text-rv-text md:hidden"
          aria-label="Menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
        <div className={`${mobileMenuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full z-10 flex-col gap-3 border-b border-rv-border bg-rv-bg p-4 md:static md:z-auto md:flex md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0`}>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="font-body text-sm text-rv-magenta transition hover:text-rv-text"
                >
                  Admin
                </Link>
              )}
              {user.role === "co_admin" && (
                <Link
                  href="/co-admin"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  Co-Admin
                </Link>
              )}
              {user.role === "co_supplier" && (
                <Link
                  href="/co-supplier"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  Stores I manage
                </Link>
              )}
              {user.role === "employee" && (
                <Link
                  href="/employee"
                  className="font-body text-sm text-rv-cyan transition hover:text-rv-text"
                >
                  My tasks
                </Link>
              )}
              <Link
                href="/reviews"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Reviews
              </Link>
              <Link
                href="/favorites"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Favorites
              </Link>
              {user.role === "seller" && (
                <Link
                  href="/returns"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Returns
                </Link>
              )}
              {(user.role === "seller" || user.role === "delivery") && (
                <Link
                  href="/kyc"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Verification
                </Link>
              )}
              {user.role === "seller" && (
                <Link
                  href="/store/new"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Open a store
                </Link>
              )}
              {user.role === "professional" && (
                <Link
                  href="/professional/skills"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  My skills
                </Link>
              )}
              {user.role === "delivery" && (
                <Link
                  href="/deliveries"
                  className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
                >
                  Deliveries
                </Link>
              )}
              <Link
                href="/notifications"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Notifications
              </Link>
              <Link
                href="/wallet"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                Wallet
              </Link>
              <Link
                href="/orders"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                My orders
              </Link>
              <Link
                href="/profile"
                className="font-body text-sm text-rv-text-dim transition hover:text-rv-cyan"
              >
                {user.name} · {user.role}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border border-rv-border px-3 py-1.5 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-rv-magenta px-4 py-1.5 font-body text-sm font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-8 pt-8 md:px-16">
        <div className="flex gap-2 overflow-x-auto border-b border-rv-border pb-2">
          {LANDING_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-md px-4 py-2 font-body text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-rv-magenta text-rv-bg shadow-hud-glow-magenta"
                  : "border border-rv-border text-rv-text-dim hover:hud-border hover:text-rv-cyan"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "postdemand" && (
        <main className="mx-auto max-w-xl px-8 py-12 md:px-16">
          <h1 className="font-display text-3xl font-semibold text-rv-text">Post a demand</h1>
          <p className="mt-2 font-body text-sm text-rv-text-dim">
            Describe what you need. A ₹10 booking fee applies once you post —
            refunded automatically if no one bids.
          </p>

          {!user && (
            <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
              Please <Link href="/login" className="underline">log in</Link> as a buyer to post a demand.
            </p>
          )}

          {user?.role !== "buyer" && user && (
            <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">
              Only buyer accounts can post demands.
            </p>
          )}

          {user?.role === "buyer" && (
            <>
              {demandPosted ? (
                <div className="hud-border glass-panel mt-8 p-6">
                  <p className="font-display text-lg font-semibold text-rv-cyan">Demand posted!</p>
                  <Link
                    href={`/demands/${demandPosted}`}
                    className="mt-2 inline-block font-body text-sm text-rv-cyan underline"
                  >
                    View your demand →
                  </Link>
                </div>
              ) : (
                <>
                  <form onSubmit={handleAiDraft} className="hud-border glass-panel mt-8 p-6 md:p-8">
                    <h2 className="font-display text-lg font-semibold text-rv-cyan">✦ Draft with AI</h2>
                    <p className="mt-1 font-body text-xs text-rv-text-dim">
                      Type roughly what you need, attach a photo, or record a voice note — we&apos;ll clean it up and suggest a category.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <textarea
                        rows={2}
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        placeholder="e.g. need too replace my brokn kitchen tap asap"
                        className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)}
                        className="w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-sm text-rv-text outline-none"
                      />

                      <div className="flex items-center gap-3">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={startRecording}
                            className="flex items-center gap-2 rounded-md border border-rv-border px-3 py-2 font-body text-sm text-rv-text transition hover:hud-border hover:text-rv-cyan"
                          >
                            🎤 Record voice note
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="flex items-center gap-2 rounded-md border border-rv-danger bg-rv-danger/10 px-3 py-2 font-body text-sm text-rv-danger animate-hud-pulse"
                          >
                            ● Stop recording
                          </button>
                        )}
                        {audioBlob && !isRecording && (
                          <div className="flex items-center gap-2">
                            <span className="font-body text-xs text-rv-cyan">Voice note ready</span>
                            <button
                              type="button"
                              onClick={clearRecording}
                              className="font-body text-xs text-rv-text-dim underline hover:text-rv-danger"
                            >
                              clear
                            </button>
                          </div>
                        )}
                      </div>
                      {micError && (
                        <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                          {micError}
                        </p>
                      )}

                      {aiError && (
                        <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                          {aiError}
                        </p>
                      )}
                      {aiDrafted && !aiError && (
                        <p className="rounded-md bg-rv-cyan/10 border border-rv-cyan/30 px-3 py-2 font-body text-sm text-rv-cyan">
                          Draft ready below — review and edit before posting.
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={aiDrafting}
                        className="rounded-md bg-rv-cyan px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow transition hover:opacity-90 disabled:opacity-60"
                      >
                        {aiDrafting ? "Drafting..." : "Draft with AI"}
                      </button>
                    </div>
                  </form>

                  <form onSubmit={handleDemandSubmit} className="glass-panel mt-6 flex flex-col gap-5 p-6 md:p-8">
                    <div>
                      <label htmlFor="demandTitle" className="font-body text-sm font-medium text-rv-text">
                        Title
                      </label>
                      <input
                        id="demandTitle"
                        type="text"
                        required
                        value={demandTitle}
                        onChange={(e) => setDemandTitle(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                        placeholder="e.g. Need 500 cotton t-shirts, or Need a maid"
                      />
                    </div>

                    <div>
                      <label htmlFor="demandDescription" className="font-body text-sm font-medium text-rv-text">
                        Description <span className="text-rv-text-dim">(optional)</span>
                      </label>
                      <textarea
                        id="demandDescription"
                        rows={3}
                        value={demandDescription}
                        onChange={(e) => setDemandDescription(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                        placeholder="Any details sellers or workers should know"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="demandBudget" className="font-body text-sm font-medium text-rv-text">
                          Budget <span className="text-rv-text-dim">(optional)</span>
                        </label>
                        <input
                          id="demandBudget"
                          type="number"
                          min={1}
                          value={demandBudget}
                          onChange={(e) => setDemandBudget(e.target.value)}
                          className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                          placeholder="₹"
                        />
                      </div>

                      <div>
                        <label htmlFor="demandCategory" className="font-body text-sm font-medium text-rv-text">
                          Category <span className="text-rv-text-dim">(optional)</span>
                        </label>
                        <input
                          id="demandCategory"
                          type="text"
                          value={demandCategory}
                          onChange={(e) => setDemandCategory(e.target.value)}
                          className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                          placeholder="e.g. clothing, cleaning, maid"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="demandHoursNeeded" className="font-body text-sm font-medium text-rv-text">
                        Hours needed <span className="text-rv-text-dim">(for hourly services like cleaning, massage, carpentry)</span>
                      </label>
                      <input
                        id="demandHoursNeeded"
                        type="number"
                        min={1}
                        value={demandHoursNeeded}
                        onChange={(e) => setDemandHoursNeeded(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-rv-border bg-rv-panel px-3 py-2 font-body text-rv-text outline-none focus:border-rv-cyan focus:shadow-hud-glow"
                        placeholder="e.g. 3"
                      />
                    </div>

                    <div>
                      <span className="font-body text-sm font-medium text-rv-text">Bidding window</span>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {DURATIONS.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setDemandDurationHours(h)}
                            className={`rounded-md border px-3 py-2 font-body text-sm transition ${
                              demandDurationHours === h
                                ? "border-rv-cyan bg-rv-cyan/10 text-rv-text shadow-hud-glow"
                                : "border-rv-border bg-rv-panel text-rv-text-dim hover:border-rv-cyan/40"
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    </div>

                    {demandError && (
                      <p className="rounded-md bg-rv-danger/10 border border-rv-danger/30 px-3 py-2 font-body text-sm text-rv-danger">
                        {demandError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submittingDemand}
                      className="mt-2 rounded-md bg-rv-magenta px-4 py-2.5 font-body font-medium text-rv-bg shadow-hud-glow-magenta transition hover:opacity-90 disabled:opacity-60"
                    >
                      {submittingDemand ? "Posting..." : "Post demand"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </main>
      )}

      {activeTab === "ecommerce" && (
        <main className="mx-auto max-w-2xl px-8 py-12 md:px-16">
          {error && (
            <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
          )}

          <section>
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
        </main>
      )}

      {activeTab === "professionals" && (
        <main className="mx-auto max-w-2xl px-8 py-12 md:px-16">
          {error && (
            <p className="mt-4 rounded-md bg-rv-danger/10 border border-rv-danger/30 px-4 py-3 font-body text-sm text-rv-danger">{error}</p>
          )}

          <section>
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
        </main>
      )}

      {activeTab === "logistics" && (
        <>
          <main className="mx-auto max-w-2xl px-8 py-12 md:px-16">
            <section>
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
          </main>
        </>
      )}
    </div>
  );
}