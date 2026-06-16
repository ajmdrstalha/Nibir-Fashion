import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  customFetch,
  getListProductsQueryKey,
  useCreateProduct,
  useDeleteProduct,
  useListProducts,
  useUpdateProduct,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ProductForm {
  name: string;
  category: string;
  size: string;
  price: string;
  stock: string;
}

interface InventoryProduct {
  id: number;
  name: string;
  category: string;
  size: string;
  price: number;
  stock: number;
  currentStock?: number;
  totalStockIn?: number;
  totalSold?: number;
}

interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  saleId: number | null;
  createdBy: number | null;
  createdByEmail: string | null;
  note: string | null;
  createdAt: string;
}

const SIZES = ["-", "XS", "S", "M", "L", "XL", "XXL", "Free"];
const CATEGORIES = ["General", "Shirt", "Pant", "Dress", "Saree", "Kameez", "Kurta", "Jacket", "Shoes", "Accessories"];
const DEFAULT_FORM: ProductForm = { name: "", category: "General", size: "-", price: "", stock: "" };

function formatBDT(amount: number) {
  return `BDT ${Number(amount).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentStock(product: InventoryProduct) {
  return product.currentStock ?? product.stock ?? 0;
}

function totalStockIn(product: InventoryProduct) {
  return product.totalStockIn ?? product.stock ?? 0;
}

function totalSold(product: InventoryProduct) {
  return product.totalSold ?? 0;
}

function stockBadge(stock: number) {
  if (stock === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(0,84%,94%)] dark:bg-[hsl(0,84%,18%)] text-[hsl(0,84%,40%)] dark:text-[hsl(0,84%,70%)]">Out of Stock</span>;
  if (stock <= 5) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(38,92%,92%)] dark:bg-[hsl(38,92%,18%)] text-[hsl(38,92%,35%)] dark:text-[hsl(38,92%,65%)]">Low: {stock}</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(142,76%,90%)] dark:bg-[hsl(142,76%,18%)] text-[hsl(142,76%,28%)] dark:text-[hsl(142,76%,65%)]">{stock} pcs</span>;
}

function ProductFormModal({
  title,
  form,
  isEdit,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  title: string;
  form: ProductForm;
  isEdit: boolean;
  onChange: (f: ProductForm) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-card border border-card-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Product Name *</label>
            <input type="text" value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} placeholder="e.g. Cotton Shirt" data-testid="input-product-name" className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
              <select value={form.category} onChange={e => onChange({ ...form, category: e.target.value })} data-testid="select-product-category" className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Size</label>
              <select value={form.size} onChange={e => onChange({ ...form, size: e.target.value })} data-testid="select-product-size" className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition">
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Selling Price (BDT) *</label>
              <input type="number" min={0} value={form.price} onChange={e => onChange({ ...form, price: e.target.value })} placeholder="0" data-testid="input-product-price" className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isEdit ? "Current Stock" : "Opening Stock"} *</label>
              <input type="number" min={0} value={form.stock} onChange={e => onChange({ ...form, stock: e.target.value })} disabled={isEdit} placeholder="0" data-testid="input-product-stock" className="w-full px-3 py-2 rounded-xl border border-input bg-background disabled:bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] transition" />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <button onClick={onSave} disabled={saving || !form.name.trim()} data-testid="button-save-product" className="flex-1 py-2.5 rounded-xl bg-[hsl(174,72%,40%)] hover:bg-[hsl(174,72%,34%)] disabled:opacity-60 text-white font-semibold text-sm transition-colors">
            {saving ? "Saving..." : "Save Product"}
          </button>
          <button onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function AddStockModal({
  products,
  selectedProductId,
  onSelectProduct,
  quantity,
  note,
  onQuantity,
  onNote,
  onSubmit,
  onClose,
  saving,
}: {
  products: InventoryProduct[];
  selectedProductId: number | null;
  onSelectProduct: (id: number) => void;
  quantity: string;
  note: string;
  onQuantity: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-card border border-card-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-4 sm:p-6 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground">Add Stock</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Product</label>
            <select value={selectedProductId ?? ""} onChange={e => onSelectProduct(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)]">
              <option value="" disabled>Select product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name} - Current {currentStock(product)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Quantity</label>
            <input type="number" min={1} value={quantity} onChange={e => onQuantity(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Note / Reference</label>
            <textarea rows={3} value={note} onChange={e => onNote(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)]" />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <button onClick={onSubmit} disabled={saving || !selectedProductId || (parseInt(quantity) || 0) <= 0} className="flex-1 py-2.5 rounded-xl bg-[hsl(174,72%,40%)] hover:bg-[hsl(174,72%,34%)] disabled:opacity-60 text-white font-semibold text-sm transition-colors">
            {saving ? "Adding..." : "Add Stock"}
          </button>
          <button onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function MovementHistoryModal({ movements, isLoading, onClose }: { movements: StockMovement[]; isLoading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-card border border-card-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Stock Movement History</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-auto">
          <table className="hidden md:table w-full">
            <thead>
              <tr className="border-b border-border">
                {["Product", "Type", "Qty", "Reason", "Note", "Date", "User"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No stock movements yet</td></tr>
              ) : movements.map(movement => (
                <tr key={movement.id} className="border-b border-border/60">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{movement.productName}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${movement.type === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{movement.type}</span></td>
                  <td className="px-4 py-3 text-sm text-foreground">{movement.quantity}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{movement.reason}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{movement.note ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(movement.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{movement.createdByEmail ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <div className="p-5 text-center text-sm text-muted-foreground">Loading...</div>
            ) : movements.length === 0 ? (
              <div className="p-5 text-center text-sm text-muted-foreground">No stock movements yet</div>
            ) : movements.map(movement => (
              <div key={movement.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{movement.productName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${movement.type === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{movement.type} {movement.quantity}</span>
                </div>
                <p className="text-xs text-muted-foreground">{movement.reason} / {movement.note ?? "No note"} / {movement.createdByEmail ?? "Unknown user"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: products = [], isLoading } = useListProducts();
  const productsList = (Array.isArray(products) ? products : []) as InventoryProduct[];
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showStockIn, setShowStockIn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(DEFAULT_FORM);
  const [stockProductId, setStockProductId] = useState<number | null>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const movementsQuery = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => customFetch<StockMovement[]>("/api/stock-movements"),
    enabled: showHistory,
  });

  const addStockMutation = useMutation({
    mutationFn: ({ productId, quantity, note }: { productId: number; quantity: number; note: string }) =>
      customFetch<InventoryProduct>(`/api/products/${productId}/stock-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity, note: note || null }),
      }),
  });

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
    ]);
  }

  function openAdd() {
    if (!isAdmin) return;
    setForm(DEFAULT_FORM);
    setEditId(null);
    setShowAdd(true);
  }

  function openEdit(product: InventoryProduct) {
    if (!isAdmin) return;
    setForm({
      name: product.name,
      category: product.category,
      size: product.size,
      price: String(product.price),
      stock: String(currentStock(product)),
    });
    setEditId(product.id);
    setShowAdd(true);
  }

  function openStockIn(product?: InventoryProduct) {
    if (!isAdmin) return;
    setStockProductId(product?.id ?? productsList[0]?.id ?? null);
    setStockQuantity("");
    setStockNote("");
    setShowStockIn(true);
  }

  function handleSave() {
    if (!isAdmin) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      size: form.size,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
    };

    if (editId !== null) {
      updateProduct.mutate({ id: editId, data: payload }, {
        onSuccess: async () => {
          setShowAdd(false);
          await invalidate();
          toast({ title: "Product updated", description: `${payload.name} was saved.` });
        },
        onError: (error: unknown) => {
          toast({ title: "Product update failed", description: error instanceof Error ? error.message : "Could not update this product.", variant: "destructive" });
        },
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: async () => {
          setShowAdd(false);
          await invalidate();
          toast({ title: "Product saved", description: `${payload.name} was added with opening stock.` });
        },
        onError: (error: unknown) => {
          toast({ title: "Product save failed", description: error instanceof Error ? error.message : "Could not save this product.", variant: "destructive" });
        },
      });
    }
  }

  function handleAddStock() {
    if (!isAdmin) return;
    if (!stockProductId) return;
    const quantity = parseInt(stockQuantity) || 0;
    if (quantity <= 0) return;

    addStockMutation.mutate({ productId: stockProductId, quantity, note: stockNote }, {
      onSuccess: async () => {
        setShowStockIn(false);
        await invalidate();
        toast({ title: "Stock added", description: `${quantity} pieces were added.` });
      },
      onError: (error: unknown) => {
        toast({ title: "Stock add failed", description: error instanceof Error ? error.message : "Could not add stock.", variant: "destructive" });
      },
    });
  }

  function handleDelete(id: number) {
    if (!isAdmin) return;
    setDeletingId(id);
    deleteProduct.mutate({ id }, {
      onSuccess: async () => {
        setDeletingId(null);
        await invalidate();
        toast({ title: "Product deleted" });
      },
      onError: (error: unknown) => {
        setDeletingId(null);
        toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Could not delete this product.", variant: "destructive" });
      },
    });
  }

  const filtered = productsList.filter(product =>
    !search ||
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.category.toLowerCase().includes(search.toLowerCase())
  );
  const saving = createProduct.isPending || updateProduct.isPending;

  return (
    <>
      {showAdd && (
        <ProductFormModal
          title={editId !== null ? "Edit Product" : "Add New Product"}
          form={form}
          isEdit={editId !== null}
          onChange={setForm}
          onSave={handleSave}
          onClose={() => setShowAdd(false)}
          saving={saving}
        />
      )}
      {showStockIn && (
        <AddStockModal
          products={productsList}
          selectedProductId={stockProductId}
          onSelectProduct={setStockProductId}
          quantity={stockQuantity}
          note={stockNote}
          onQuantity={setStockQuantity}
          onNote={setStockNote}
          onSubmit={handleAddStock}
          onClose={() => setShowStockIn(false)}
          saving={addStockMutation.isPending}
        />
      )}
      {showHistory && (
        <MovementHistoryModal
          movements={movementsQuery.data ?? []}
          isLoading={movementsQuery.isLoading}
          onClose={() => setShowHistory(false)}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-4 sm:px-5 py-4 border-b border-border gap-3">
            <h2 className="text-sm font-bold text-foreground">Product Inventory</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="search" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-products" className="pl-9 pr-4 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(174,72%,40%)] w-full sm:w-52 transition" />
              </div>
              {isAdmin && (
                <button onClick={() => openStockIn()} data-testid="button-add-stock" className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,45%)] text-white text-sm font-semibold transition-colors w-full sm:w-auto">
                  <Plus className="w-4 h-4" />Add Stock
                </button>
              )}
              <button onClick={() => setShowHistory(true)} data-testid="button-stock-history" className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors w-full sm:w-auto">
                <History className="w-4 h-4" />History
              </button>
              {isAdmin && (
                <button onClick={openAdd} data-testid="button-add-product" className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg bg-[hsl(174,72%,40%)] hover:bg-[hsl(174,72%,34%)] text-white text-sm font-semibold transition-colors w-full sm:w-auto">
                  <Plus className="w-4 h-4" />Add Product
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="hidden lg:table w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  {["Product Name", "Selling Price", "Total Stock In", "Total Sold", "Current Stock", "Stock Status", ...(isAdmin ? ["Actions"] : [])].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {Array.from({ length: isAdmin ? 7 : 6 }).map((__, j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="px-5 py-16 text-center text-sm text-muted-foreground">No products found.</td></tr>
                ) : filtered.map(product => (
                  <tr key={product.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors" data-testid={`row-product-${product.id}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category} / {product.size}</p>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-foreground">{formatBDT(product.price)}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{totalStockIn(product)}</td>
                    <td className="px-5 py-3 text-sm text-foreground">{totalSold(product)}</td>
                    <td className="px-5 py-3 text-sm font-bold text-foreground">{currentStock(product)}</td>
                    <td className="px-5 py-3">{stockBadge(currentStock(product))}</td>
                    {isAdmin && (
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openStockIn(product)} className="p-2 rounded-lg bg-[hsl(174,72%,40%)] hover:bg-[hsl(174,72%,34%)] text-white transition-colors" title="Add stock"><Plus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(product)} data-testid={`button-edit-${product.id}`} className="p-2 rounded-lg bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,45%)] text-white transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(product.id)} disabled={deletingId === product.id} data-testid={`button-delete-${product.id}`} className="p-2 rounded-lg bg-[hsl(0,84%,55%)] hover:bg-[hsl(0,84%,48%)] disabled:opacity-50 text-white transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-4 space-y-3"><div className="h-4 bg-muted animate-pulse rounded w-3/4" /><div className="h-4 bg-muted animate-pulse rounded w-1/2" /><div className="h-9 bg-muted animate-pulse rounded" /></div>)
            ) : filtered.length === 0 ? (
              <div className="px-5 py-14 text-center"><Package className="w-10 h-10 opacity-30 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No products found.</p></div>
            ) : filtered.map(product => (
              <div key={product.id} className="p-4 space-y-3" data-testid={`card-product-${product.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground break-words">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.category} / {product.size}</p>
                  </div>
                  {stockBadge(currentStock(product))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Selling Price</p><p className="font-bold text-foreground">{formatBDT(product.price)}</p></div>
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Current Stock</p><p className="font-bold text-foreground">{currentStock(product)}</p></div>
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Total Stock In</p><p className="font-bold text-foreground">{totalStockIn(product)}</p></div>
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Total Sold</p><p className="font-bold text-foreground">{totalSold(product)}</p></div>
                </div>
                {isAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button onClick={() => openStockIn(product)} className="h-9 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(174,72%,40%)] text-white text-xs font-semibold"><Plus className="w-4 h-4" />Stock</button>
                    <button onClick={() => openEdit(product)} className="h-9 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(221,83%,53%)] text-white text-xs font-semibold"><Pencil className="w-4 h-4" />Edit</button>
                    <button onClick={() => handleDelete(product.id)} disabled={deletingId === product.id} className="h-9 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(0,84%,55%)] disabled:opacity-50 text-white text-xs font-semibold"><Trash2 className="w-4 h-4" />Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filtered.length > 0 && <div className="px-5 py-3 border-t border-border"><p className="text-xs text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? "s" : ""} total</p></div>}
        </div>
      </div>
    </>
  );
}
