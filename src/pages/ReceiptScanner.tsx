import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  Camera,
  Upload,
  ScanLine,
  Check,
  X,
  Trash2,
  CreditCard as Edit3,
  Plus,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Receipt,
  Store,
  Calendar,
  DollarSign,
  ShoppingBag,
  ZoomIn,
  ArrowRight,
} from "lucide-react";
import { useCurrency } from "../contexts/CurrencyContext";
import toast from "react-hot-toast";

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptData {
  id: string;
  user_id: string;
  store_name: string;
  receipt_date: string;
  total_amount: number;
  items: ReceiptItem[];
  raw_text: string;
  image_url: string;
  status: "scanning" | "review" | "confirmed" | "error";
  expense_id: string | null;
  created_at: string;
}

interface ParsedReceipt {
  storeName: string;
  date: string;
  items: ReceiptItem[];
  total: number;
  rawText: string;
}

const ReceiptScanner = () => {
  const { currency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReceipt | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "review" | "confirmed">("all");
  const [dragActive, setDragActive] = useState(false);

  // Editable parsed data for review
  const [editStoreName, setEditStoreName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editItems, setEditItems] = useState<ReceiptItem[]>([]);
  const [editTotal, setEditTotal] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) fetchReceipts();
    };
    getUser();
  }, []);

  const fetchReceipts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching receipts:", error);
      return;
    }

    setReceipts(data || []);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    return fileName;
  };

  const getImageUrl = async (path: string): Promise<string> => {
    if (!path) return "";
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  };

  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadImages = async () => {
      const urls: Record<string, string> = {};
      for (const receipt of receipts) {
        if (receipt.image_url) {
          const url = await getImageUrl(receipt.image_url);
          urls[receipt.id] = url;
        }
      }
      setImageUrls(urls);
    };
    if (receipts.length > 0) loadImages();
  }, [receipts]);

 const processReceipt = async (file: File) => {
   if (!user) return;

   setIsScanning(true);
   setScanProgress(0);
   setPreviewImage(null);
   setParsedData(null);
   setShowReview(false);

   // Show preview immediately
   const reader = new FileReader();
   reader.onload = (e) => setPreviewImage(e.target?.result as string);
   reader.readAsDataURL(file);

   try {
     // ── Step 1: Upload image to Supabase storage ──────────────────────
     const imagePath = await uploadImage(file);

     // ── Step 2: OCR entirely in the browser (free, no API key) ────────
     const { createWorker } = await import("tesseract.js");
     const worker = await createWorker("eng", 1, {
       logger: (m) => {
         if (m.status === "recognizing text") {
           setScanProgress(Math.round(m.progress * 85)); // reserve last 15% for parse
         }
       },
     });
     const { data } = await worker.recognize(file);
     await worker.terminate();
     const ocrText = data.text;

     setScanProgress(90);

     // ── Step 3: Convert image to base64 for the edge function ──────────
     const arrayBuffer = await file.arrayBuffer();
     const bytes = new Uint8Array(arrayBuffer);
     let binary = "";
     bytes.forEach((b) => (binary += String.fromCharCode(b)));
     const imageBase64 = btoa(binary);

     // ── Step 4: Send OCR text to edge function for structured parsing ──
     const { data: sessionData } = await supabase.auth.getSession();
     const accessToken = sessionData.session?.access_token;

     const response = await fetch(
       `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${accessToken}`,
         },
         body: JSON.stringify({ ocrText, imageBase64, mimeType: file.type }),
       },
     );

     const result = await response.json();
     setScanProgress(100);

     const parsed: ParsedReceipt =
       result.success && result.parsed
         ? result.parsed
         : {
             storeName: "",
             date: new Date().toISOString().split("T")[0],
             items: [],
             total: 0,
             rawText: ocrText, // keep raw text even on parse failure
           };

     // ── Step 5: Save to DB as "review" ────────────────────────────────
     const { data: receiptData, error: dbError } = await supabase
       .from("receipts")
       .insert({
         user_id: user.id,
         store_name: parsed.storeName,
         receipt_date: parsed.date,
         total_amount: parsed.total,
         items: parsed.items,
         raw_text: parsed.rawText,
         image_url: imagePath,
         status: "review",
       })
       .select()
       .single();

     if (dbError) throw dbError;

     setParsedData(parsed);
     setEditStoreName(parsed.storeName);
     setEditDate(parsed.date);
     setEditItems(
       parsed.items.length > 0 ? parsed.items : [{ name: "", price: 0 }],
     );
     setEditTotal(parsed.total);
     setShowReview(true);
     fetchReceipts();

     toast.success("Receipt scanned! Review the details below.");
   } catch (error) {
     console.error("Error processing receipt:", error);
     toast.error("Failed to process receipt. Please try again.");
   } finally {
     setIsScanning(false);
     setScanProgress(0);
   }
 };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB");
        return;
      }
      processReceipt(file);
    }
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processReceipt(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const confirmReceipt = async (receiptId: string) => {
    try {
      // Update receipt status
      const { error: receiptError } = await supabase
        .from("receipts")
        .update({
          store_name: editStoreName,
          receipt_date: editDate,
          total_amount: editTotal,
          items: editItems.filter((item) => item.name && item.price > 0),
          status: "confirmed",
        })
        .eq("id", receiptId);

      if (receiptError) throw receiptError;

      // Auto-create an expense from the receipt
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          user_id: user.id,
          amount: editTotal,
          description: `Receipt: ${editStoreName}`,
          date: editDate,
        })
        .select()
        .single();

      if (!expenseError && expenseData) {
        await supabase
          .from("receipts")
          .update({ expense_id: expenseData.id })
          .eq("id", receiptId);
      }

      setShowReview(false);
      setPreviewImage(null);
      setParsedData(null);
      fetchReceipts();
      toast.success("Receipt confirmed and expense created!");
    } catch (error) {
      console.error("Error confirming receipt:", error);
      toast.error("Failed to confirm receipt");
    }
  };

  const deleteReceipt = async (receiptId: string) => {
    try {
      const receipt = receipts.find((r) => r.id === receiptId);

      // Delete image from storage
      if (receipt?.image_url) {
        await supabase.storage.from("receipts").remove([receipt.image_url]);
      }

      // Delete receipt record
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("id", receiptId);

      if (error) throw error;

      setReceipts(receipts.filter((r) => r.id !== receiptId));
      toast.success("Receipt deleted");
    } catch (error) {
      console.error("Error deleting receipt:", error);
      toast.error("Failed to delete receipt");
    }
  };

  const addEditItem = () => {
    setEditItems([...editItems, { name: "", price: 0 }]);
  };

  const removeEditItem = (index: number) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
    const newTotal = newItems.reduce((sum, item) => sum + item.price, 0);
    setEditTotal(Math.round(newTotal * 100) / 100);
  };

  const updateEditItem = (
    index: number,
    field: "name" | "price",
    value: string | number,
  ) => {
    const newItems = [...editItems];
    if (field === "name") {
      newItems[index].name = value as string;
    } else {
      newItems[index].price = parseFloat(value as string) || 0;
    }
    setEditItems(newItems);
    const newTotal = newItems.reduce((sum, item) => sum + item.price, 0);
    setEditTotal(Math.round(newTotal * 100) / 100);
  };

  const cancelReview = () => {
    setShowReview(false);
    setPreviewImage(null);
    setParsedData(null);
  };

  const filteredReceipts = receipts.filter((r) => {
    if (filter === "review") return r.status === "review";
    if (filter === "confirmed") return r.status === "confirmed";
    return true;
  });

  const stats = {
    total: receipts.length,
    confirmed: receipts.filter((r) => r.status === "confirmed").length,
    review: receipts.filter((r) => r.status === "review").length,
    totalAmount: receipts
      .filter((r) => r.status === "confirmed")
      .reduce((sum, r) => sum + Number(r.total_amount), 0),
  };

  const currentReviewReceipt = receipts.find(
    (r) => r.status === "review" && showReview,
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={zoomImage}
              alt="Receipt zoom"
              className="w-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow rounded-xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0_0_#000]">
              <ScanLine size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl text-black">
                Smart Receipt Scanner
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Snap a receipt, auto-extract details, track spending
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">
                Total Scans
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-center gap-2 mb-1">
              <Check size={14} className="text-green-600" />
              <span className="text-xs text-gray-500 font-medium">
                Confirmed
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {stats.confirmed}
            </p>
          </div>
          <div className="bg-yellow/20 border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-yellow-600" />
              <span className="text-xs text-gray-500 font-medium">
                Needs Review
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">
              {stats.review}
            </p>
          </div>
          <div className="bg-white border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">
                Total Tracked
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {currency.symbol}
              {stats.totalAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Scan Section */}
        <div className="mb-8">
          <div
            className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 ${
              dragActive
                ? "border-yellow bg-yellow/10 scale-[1.01]"
                : "border-black bg-white"
            } ${isScanning ? "pointer-events-none" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isScanning ? (
              <div className="p-8 sm:p-16 text-center">
                {/* Scanning Animation */}
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-6">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="Receipt preview"
                      className="w-full h-full object-cover rounded-xl opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-black rounded-full border-t-yellow animate-spin" />
                      <ScanLine
                        size={24}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black"
                      />
                    </div>
                  </div>
                  {/* Scan line animation */}
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-yellow shadow-[0_0_8px_rgba(255,204,0,0.8)] animate-scan-line"
                    style={{ top: "10%" }}
                  />
                </div>
                <p className="font-serif text-lg sm:text-xl mb-2">
                  Scanning receipt...
                </p>
                <div className="w-48 sm:w-64 mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-yellow transition-all duration-300 rounded-full"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {scanProgress < 30
                    ? "Reading image..."
                    : scanProgress < 60
                      ? "Extracting text..."
                      : scanProgress < 90
                        ? "Parsing items..."
                        : "Almost done!"}
                </p>
              </div>
            ) : (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-yellow/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-yellow">
                  <Camera size={32} className="sm:w-10 sm:h-10 text-black" />
                </div>
                <h2 className="font-serif text-xl sm:text-2xl mb-2">
                  Scan a Receipt
                </h2>
                <p className="text-gray-500 text-sm sm:text-base mb-6 max-w-md mx-auto">
                  Take a photo or upload an image of your receipt. We'll
                  automatically extract the store, items, and total.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow text-black font-medium px-6 py-3 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <Camera size={18} />
                    Take Photo
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black text-white font-medium px-6 py-3 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <Upload size={18} />
                    Upload Image
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Supports JPG, PNG, WEBP up to 10MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Review Section */}
        {showReview && currentReviewReceipt && (
          <div className="mb-8 border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0_0_#000]">
            <div className="bg-yellow px-4 sm:px-6 py-3 flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Edit3 size={18} />
                <h2 className="font-serif text-lg sm:text-xl">
                  Review Scanned Receipt
                </h2>
              </div>
              <button
                onClick={cancelReview}
                className="text-black hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image Preview */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Receipt Image
                  </h3>
                  <div className="relative group">
                    {previewImage && (
                      <img
                        src={previewImage}
                        alt="Receipt"
                        className="w-full rounded-xl border-2 border-gray-200 object-contain max-h-80"
                      />
                    )}
                    {previewImage && (
                      <button
                        onClick={() => setZoomImage(previewImage)}
                        className="absolute top-2 right-2 bg-black/70 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ZoomIn size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable Details */}
                <div className="space-y-4">
                  {/* Store Name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1">
                      <Store size={14} />
                      Store Name
                    </label>
                    <input
                      type="text"
                      value={editStoreName}
                      onChange={(e) => setEditStoreName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none transition-colors text-sm"
                      placeholder="Enter store name"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1">
                      <Calendar size={14} />
                      Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none transition-colors text-sm"
                    />
                  </div>

                  {/* Items */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-2">
                      <ShoppingBag size={14} />
                      Items
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {editItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 group"
                        >
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              updateEditItem(index, "name", e.target.value)
                            }
                            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none transition-colors text-sm"
                            placeholder="Item name"
                          />
                          <div className="relative w-28 flex-shrink-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                              {currency.symbol}
                            </span>
                            <input
                              type="number"
                              value={item.price || ""}
                              onChange={(e) =>
                                updateEditItem(index, "price", e.target.value)
                              }
                              className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none transition-colors text-sm"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <button
                            onClick={() => removeEditItem(index)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addEditItem}
                      className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors"
                    >
                      <Plus size={14} />
                      Add item
                    </button>
                  </div>

                  {/* Total */}
                  <div className="bg-gray-50 rounded-xl p-3 border-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-600">
                        Total Amount
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-sm">
                          {currency.symbol}
                        </span>
                        <input
                          type="number"
                          value={editTotal || ""}
                          onChange={(e) =>
                            setEditTotal(parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-right text-lg font-bold bg-transparent focus:outline-none focus:border-b-2 focus:border-yellow"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => confirmReceipt(currentReviewReceipt.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-medium px-4 py-3 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm"
                    >
                      <Check size={18} />
                      Confirm & Create Expense
                    </button>
                    <button
                      onClick={cancelReview}
                      className="px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-500 hover:border-black hover:text-black transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receipt History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl sm:text-2xl">Receipt History</h2>
            <div className="flex items-center gap-2">
              {(["all", "review", "confirmed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all ${
                    filter === f
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black"
                  }`}
                >
                  {f === "all"
                    ? "All"
                    : f === "review"
                      ? "Needs Review"
                      : "Confirmed"}
                </button>
              ))}
            </div>
          </div>

          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
              <ImageIcon size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-medium">
                No receipts scanned yet
              </p>
              <p className="text-gray-300 text-sm mt-1">
                Scan your first receipt to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReceipts.map((receipt) => {
                const isExpanded = expandedReceipt === receipt.id;
                const imageUrl = imageUrls[receipt.id] || "";
                const receiptItems =
                  typeof receipt.items === "string"
                    ? JSON.parse(receipt.items)
                    : receipt.items || [];

                return (
                  <div
                    key={receipt.id}
                    className="border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <div
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedReceipt(isExpanded ? null : receipt.id)
                      }
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Receipt thumb"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Receipt size={20} className="text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm sm:text-base truncate">
                            {receipt.store_name || "Unknown Store"}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                              receipt.status === "confirmed"
                                ? "bg-green-100 text-green-700"
                                : receipt.status === "review"
                                  ? "bg-yellow/20 text-yellow-700"
                                  : receipt.status === "error"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {receipt.status === "review"
                              ? "Review"
                              : receipt.status.charAt(0).toUpperCase() +
                                receipt.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                          {receipt.receipt_date
                            ? new Date(receipt.receipt_date).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "No date"}
                          {" · "}
                          {receiptItems.length} item
                          {receiptItems.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <p className="font-bold text-sm sm:text-lg">
                          {currency.symbol}
                          {Number(receipt.total_amount).toFixed(2)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReceipt(receipt.id);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t-2 border-gray-100 p-4 sm:p-6 bg-gray-50/50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Items List */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-2">
                              Items
                            </h4>
                            {receiptItems.length > 0 ? (
                              <div className="space-y-1.5">
                                {receiptItems.map(
                                  (item: ReceiptItem, i: number) => (
                                    <div
                                      key={i}
                                      className="flex justify-between text-sm"
                                    >
                                      <span className="text-gray-700 truncate mr-2">
                                        {item.name}
                                      </span>
                                      <span className="text-gray-900 font-medium flex-shrink-0">
                                        {currency.symbol}
                                        {item.price.toFixed(2)}
                                      </span>
                                    </div>
                                  ),
                                )}
                                <div className="border-t border-gray-200 pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
                                  <span>Total</span>
                                  <span>
                                    {currency.symbol}
                                    {Number(receipt.total_amount).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">
                                No items extracted
                              </p>
                            )}
                          </div>

                          {/* Image & Actions */}
                          <div>
                            {imageUrl && (
                              <div className="relative group mb-3">
                                <img
                                  src={imageUrl}
                                  alt="Receipt"
                                  className="w-full rounded-lg border border-gray-200 object-contain max-h-48"
                                />
                                <button
                                  onClick={() => setZoomImage(imageUrl)}
                                  className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ZoomIn size={14} />
                                </button>
                              </div>
                            )}
                            {receipt.status === "review" && (
                              <button
                                onClick={() => {
                                  const r = receipt;
                                  setEditStoreName(r.store_name);
                                  setEditDate(
                                    r.receipt_date ||
                                      new Date().toISOString().split("T")[0],
                                  );
                                  setEditItems(
                                    receiptItems.length > 0
                                      ? receiptItems
                                      : [
                                          {
                                            name: "",
                                            price: 0,
                                          },
                                        ],
                                  );
                                  setEditTotal(Number(r.total_amount));
                                  setPreviewImage(imageUrl);
                                  setShowReview(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-yellow text-black font-medium px-4 py-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all text-sm"
                              >
                                <Edit3 size={16} />
                                Review & Confirm
                              </button>
                            )}
                            {receipt.status === "confirmed" &&
                              receipt.expense_id && (
                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                                  <Check size={14} />
                                  Expense created
                                  <ArrowRight size={14} />
                                  <span className="font-mono text-xs">
                                    ...{receipt.expense_id.slice(-6)}
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
