import { useState, useRef } from "react";
import { Plus, Printer, X } from "lucide-react";
import { useCreateSale, useListProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTodaySummaryQueryKey, getGetMonthSummaryQueryKey, getGetMonthlyTotalsQueryKey, getListProductsQueryKey, getListSalesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface SaleItem {
  id: number;
  productId: number | null;
  name: string;
  size: string;
  qty: number;
  rate: number;
}

function formatBDT(amount: number) {
  return `BDT ${Number(amount).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generateBillNo() {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `NF-${d}${rand}`;
}

type SaleProduct = {
  id: number;
  name: string;
  size: string;
  price: number;
  stock: number;
  currentStock?: number;
};

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const SIZES = ["-", "XS", "S", "M", "L", "XL", "XXL", "Free"];

function ReceiptPreview({ billNo, date, customer, phone, items, note }: {
  billNo: string;
  date: string;
  customer: string;
  phone: string;
  items: SaleItem[];
  note: string;
}) {
  const total = items.reduce((s, i) => s + i.qty * i.rate, 0);
  return (
    <div className="font-mono text-[11px] leading-relaxed text-gray-800 dark:text-gray-200 p-1">
      <div className="text-center mb-3">
        <p className="text-base font-bold">Nibir Fashion</p>
        <p className="text-[10px] text-gray-600 dark:text-gray-400">Address: Bonmala Road, Tongi College Gate, Gazipur, Dhaka</p>
        <p className="text-[10px] text-gray-600 dark:text-gray-400">Phone: 01933-479506</p>
      </div>
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2 space-y-1">
        <div className="flex justify-between"><span>Customer</span><span className="font-medium">{customer || "-"}</span></div>
        <div className="flex justify-between"><span>Phone</span><span>{phone || "-"}</span></div>
        <div className="flex justify-between"><span>Bill No</span><span>{billNo}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{date}</span></div>
      </div>
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
          <span className="flex-[2]">Item</span>
          <span className="w-8 text-center">Size</span>
          <span className="w-6 text-center">Qty</span>
          <span className="w-20 text-right">Rate</span>
        </div>
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-1">No items</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="flex justify-between py-0.5">
              <span className="flex-[2] truncate">{item.name || "-"}</span>
              <span className="w-8 text-center">{item.size}</span>
              <span className="w-6 text-center">{item.qty}</span>
              <span className="w-20 text-right">{formatBDT(item.rate)}</span>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-dashed border-gray-400 pt-2 flex justify-between font-bold">
        <span>Total</span><span>{formatBDT(total)}</span>
      </div>
      {note && (
        <div className="mt-3 border border-gray-300 dark:border-gray-600 rounded p-2 text-[10px] text-gray-600 dark:text-gray-400">{note}</div>
      )}
      <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded p-2">
        Return Policy: Products purchased from Nibir Fashion can be returned or exchanged within 7 days with this billing receipt. The product must be unused and in original condition.
      </div>
    </div>
  );
}

export default function NewSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSale = useCreateSale();
  const { data: products = [] } = useListProducts();
  const productsList = (Array.isArray(products) ? products : []) as SaleProduct[];

  const [billNo] = useState(generateBillNo);
  const [date, setDate] = useState(todayISO);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<SaleItem[]>([{ id: 1, productId: null, name: "", size: "-", qty: 1, rate: 0 }]);
  const [savedSale, setSavedSale] = useState<{ billNo: string; date: string; customer: string; phone: string; note: string; items: SaleItem[] } | null>(null);
  const nextId = useRef(2);
  const receiptRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((s, i) => s + i.qty * i.rate, 0);

  const addItem = () => {
    setItems(prev => [...prev, { id: nextId.current++, productId: null, name: "", size: "-", qty: 1, rate: 0 }]);
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleProductSelect = (itemId: number, productId: string) => {
    if (productId === "") {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, productId: null, name: "", size: "-", rate: 0 } : i));
      return;
    }
    const pid = parseInt(productId);
    const product = productsList.find(p => p.id === pid);
    if (product) {
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, productId: pid, name: product.name, size: product.size, rate: product.price } : i
      ));
    }
  };

  const updateItem = (id: number, field: keyof SaleItem, value: string | number | null) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleComplete = () => {
    const validItems = items.filter(i => i.name.trim() && i.productId);
    if (validItems.length === 0) return;

    for (const item of validItems) {
      const product = productsList.find(p => p.id === item.productId);
      const available = product?.currentStock ?? product?.stock ?? 0;

      if (!product || item.qty > available) {
        toast({
          title: "Not enough stock available",
          description: `${item.name} has ${available} in stock.`,
          variant: "destructive",
        });
        return;
      }
    }

    createSale.mutate(
      {
        data: {
          billNo,
          date,
          customer: customer || "Walk-in",
          phone: phone || null,
          note: note || null,
          paymentMethod: "Cash",
          items: validItems.map(i => ({
            name: i.name,
            productId: i.productId as number,
            size: i.size,
            qty: i.qty,
            rate: i.rate,
          })),
        },
      },
      {
        onSuccess: async () => {
          setSavedSale({ billNo, date, customer: customer || "Walk-in", phone, note, items: [...validItems] });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetMonthSummaryQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetMonthlyTotalsQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
          ]);
          toast({ title: "Sale saved", description: "Dashboard totals and sales history were updated." });
        },
        onError: (error: unknown) => {
          toast({
            title: "Sale failed",
            description: error instanceof Error ? error.message : "Could not save this sale.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt - ${billNo}</title>
      <style>body{font-family:monospace;font-size:11px;max-width:300px;margin:0 auto;padding:16px;}
      .flex{display:flex;}.justify-between{justify-content:space-between;}
      .text-center{text-align:right;}.font-bold{font-weight:bold;}
      .border-t{border-top:1px dashed #888;}.border{border:1px solid #ccc;}
      .rounded{border-radius:4px;}.p-2{padding:8px;}.pt-2{padding-top:8px;}
      .mb-2{margin-bottom:8px;}.mb-3{margin-bottom:12px;}.mt-3{margin-top:12px;}
      .w-8{width:2rem;}.w-6{width:1.5rem;}.w-20{width:5rem;}
      .flex-\\[2\\]{flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .space-y-1>*+*{margin-top:4px;}.py-0\\.5{padding:2px 0;}</style>
      </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleClear = () => {
    setCustomer("");
    setPhone("");
    setNote("");
    setItems([{ id: nextId.current++, productId: null, name: "", size: "-", qty: 1, rate: 0 }]);
    setSavedSale(null);
  };

  const previewItems = savedSale ? savedSale.items : items;
  const previewCustomer = savedSale ? savedSale.customer : customer;
  const previewPhone = savedSale ? savedSale.phone : phone;
  const previewNote = savedSale ? savedSale.note : note;

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-5">
      <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm min-w-0">
        {/* Store info + bill meta */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-5 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Nibir Fashion</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Address: Bonmala Road, Tongi College Gate, Gazipur, Dhaka</p>
            <p className="text-xs text-muted-foreground">Phone: 01933-479506</p>
          </div>
          <div className="space-y-2 w-full sm:w-auto sm:min-w-[200px]">
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Bill No</label>
              <input type="text" value={billNo} readOnly data-testid="input-bill-no"
                className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-input bg-muted/50 text-foreground focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-date"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer Name</label>
            <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" data-testid="input-customer"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer Phone <span className="text-muted-foreground/60">(optional)</span></label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" data-testid="input-phone"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="+" data-testid="input-note"
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] resize-none transition" />
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="hidden md:grid grid-cols-[1fr_90px_80px_110px_36px] gap-2 px-1 mb-1">
            {["Product", "Size", "Qty", "Rate (BDT)", ""].map(h => (
              <span key={h} className="text-xs font-semibold text-muted-foreground">{h}</span>
            ))}
          </div>

          <div className="space-y-3 md:space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_90px_80px_110px_36px] gap-2 items-end rounded-xl border border-border p-3 md:p-0 md:border-0" data-testid={`row-item-${idx}`}>

                {/* Product dropdown */}
                <label className="col-span-2 md:col-span-1">
                  <span className="md:hidden text-xs font-medium text-muted-foreground block mb-1">Product</span>
                  <select
                  value={item.productId ?? ""}
                  onChange={e => handleProductSelect(item.id, e.target.value)}
                  data-testid={`select-product-${idx}`}
                  className="w-full min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition"
                >
                  <option value="">— Select product —</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.size !== "-" ? `(${p.size})` : ""} - Stock {p.currentStock ?? p.stock}
                    </option>
                  ))}
                  </select>
                </label>

                {/* Size override */}
                <label>
                  <span className="md:hidden text-xs font-medium text-muted-foreground block mb-1">Size</span>
                  <select value={item.size} onChange={e => updateItem(item.id, "size", e.target.value)} data-testid={`select-size-${idx}`}
                    className="w-full px-2 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label>
                  <span className="md:hidden text-xs font-medium text-muted-foreground block mb-1">Qty</span>
                  <input type="number" value={item.qty} min={1} onChange={e => updateItem(item.id, "qty", Math.max(1, parseInt(e.target.value) || 1))} data-testid={`input-qty-${idx}`}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] text-center transition" />
                </label>

                <label className="col-span-2 md:col-span-1">
                  <span className="md:hidden text-xs font-medium text-muted-foreground block mb-1">Rate (BDT)</span>
                  <input type="number" value={item.rate || ""} min={0} placeholder="0" onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} data-testid={`input-rate-${idx}`}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
                </label>

                <button onClick={() => removeItem(item.id)} disabled={items.length === 1} data-testid={`button-remove-item-${idx}`}
                  className="col-span-2 md:col-span-1 w-full md:w-9 h-9 flex items-center justify-center rounded-lg bg-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,50%)] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {productsList.length === 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              No products in inventory. Add products in the Products section first.
            </p>
          )}

          <button onClick={addItem} data-testid="button-add-item"
            className="mt-3 flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,45%)] text-white text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />Add Item
          </button>
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-lg font-extrabold text-foreground" data-testid="text-total">{formatBDT(total)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <button onClick={handleComplete} disabled={createSale.isPending} data-testid="button-complete-sale"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[hsl(174,72%,40%)] hover:bg-[hsl(174,72%,34%)] disabled:opacity-60 text-white font-semibold text-sm transition-colors">
              {createSale.isPending ? "Saving..." : "Complete Sale"}
            </button>
            <button onClick={handlePrint} data-testid="button-print-bill"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,45%)] text-white font-semibold text-sm transition-colors">
              <Printer className="w-4 h-4" />Print Bill
            </button>
            <button onClick={handleClear} data-testid="button-clear"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm transition-colors">
              Clear
            </button>
          </div>
          {savedSale && (
            <div className="px-4 py-3 rounded-xl bg-[hsl(174,72%,94%)] dark:bg-[hsl(174,72%,20%)] border border-[hsl(174,72%,75%)] dark:border-[hsl(174,72%,35%)] text-[hsl(174,72%,28%)] dark:text-[hsl(174,72%,70%)] text-sm font-semibold">
              Sale saved successfully!
            </div>
          )}
          {createSale.isError && (
            <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold">
              Failed to save sale. Please try again.
            </div>
          )}
        </div>
      </div>

      {/* Receipt preview */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-[hsl(221,83%,53%)]">
          <h3 className="text-sm font-bold text-white">Receipt Preview</h3>
        </div>
        <div className="p-4" ref={receiptRef}>
          <ReceiptPreview billNo={billNo} date={date} customer={previewCustomer} phone={previewPhone} items={previewItems} note={previewNote} />
        </div>
      </div>
    </div>
  );
}
