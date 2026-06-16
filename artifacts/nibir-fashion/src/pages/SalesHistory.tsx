import { useState, useMemo } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import { useListSales } from "@workspace/api-client-react";

interface SaleItemType {
  id: number;
  saleId: number;
  name: string;
  size: string;
  qty: number;
  rate: number;
  amount: number;
}

interface SaleType {
  id: number;
  billNo: string;
  date: string;
  customer: string;
  phone: string | null;
  note: string | null;
  paymentMethod: string;
  total: number;
  createdAt: string;
  items: SaleItemType[];
}

function formatBDT(amount: number) {
  return `BDT ${Number(amount).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function SaleDetailModal({ sale, onClose }: { sale: SaleType; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-card border border-card-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">{sale.billNo}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{sale.date} · {sale.paymentMethod}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" data-testid="button-close-modal">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1 mb-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Customer</span>
            <span className="font-medium text-foreground">{sale.customer}</span>
          </div>
          {sale.phone && (
            <div className="flex justify-between text-muted-foreground">
              <span>Phone</span>
              <span className="font-medium text-foreground">{sale.phone}</span>
            </div>
          )}
        </div>
        <div className="border-t border-border pt-4 mb-4">
          <div className="grid grid-cols-[minmax(0,1fr)_42px_70px_78px] sm:grid-cols-[1fr_48px_80px_80px] gap-2 text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
            <span>Item</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
          </div>
          {sale.items.map((item, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_42px_70px_78px] sm:grid-cols-[1fr_48px_80px_80px] gap-2 py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-foreground truncate">{item.name}</span>
              <span className="text-sm text-center text-foreground">{item.qty}</span>
              <span className="text-sm text-right text-muted-foreground">{formatBDT(item.rate)}</span>
              <span className="text-sm text-right font-semibold text-foreground">{formatBDT(item.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="font-bold text-foreground">Total</span>
          <span className="font-extrabold text-foreground">{formatBDT(sale.total)}</span>
        </div>
        {sale.note && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg p-3">{sale.note}</div>
        )}
      </div>
    </div>
  );
}

export default function SalesHistory() {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<SaleType | null>(null);
  const PER_PAGE = 20;

  const { data: allSales = [], isLoading } = useListSales();
  const allSalesList = Array.isArray(allSales) ? allSales : [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (allSalesList as SaleType[]).filter(s => {
      const matchesSearch =
        !q ||
        s.billNo.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        s.paymentMethod.toLowerCase().includes(q);
      const matchesDate = !selectedDate || s.date === selectedDate;
      return matchesSearch && matchesDate;
    });
  }, [search, selectedDate, allSalesList]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      {viewing && <SaleDetailModal sale={viewing} onClose={() => setViewing(null)} />}

      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-4 border-b border-border gap-3">
            <h2 className="text-sm font-bold text-foreground">Sales History</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="search" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} data-testid="input-search"
                  className="pl-9 pr-4 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(45,65%,52%)] w-full sm:w-52 transition" />
              </div>
              <div className="relative w-full sm:w-auto">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setPage(1); }} data-testid="input-date-filter"
                  className="pl-9 pr-3 py-2 sm:py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(45,65%,52%)] w-full sm:w-44 transition" />
              </div>
            </div>
          </div>

          <table className="hidden md:table w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Total</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Paid</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Due</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {search ? "No sales matching your search" : "No sales recorded yet. Create your first sale!"}
                  </td>
                </tr>
              ) : (
                paginated.map((sale, idx) => {
                  const num = (page - 1) * PER_PAGE + idx + 1;
                  return (
                    <tr key={sale.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors" data-testid={`row-sale-${sale.id}`}>
                      <td className="px-5 py-3 text-sm font-medium text-muted-foreground">#{num}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{sale.customer}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-foreground">{formatBDT(sale.total)}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{formatBDT(sale.total)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatBDT(0)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(sale.date)}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => setViewing(sale as SaleType)} data-testid={`button-view-${sale.id}`}
                          className="px-4 py-1.5 rounded-lg bg-[hsl(45,65%,52%)] hover:bg-[hsl(43,89%,38%)] text-black hover:text-white text-xs font-semibold transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  <div className="h-9 bg-muted animate-pulse rounded" />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                {search ? "No sales matching your search" : "No sales recorded yet. Create your first sale!"}
              </div>
            ) : (
              paginated.map((sale, idx) => {
                const num = (page - 1) * PER_PAGE + idx + 1;
                return (
                  <div key={sale.id} className="p-4 space-y-3" data-testid={`card-sale-${sale.id}`}>
                    <div className="space-y-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">#{num} / {formatDate(sale.date)}</p>
                        <h3 className="text-sm font-semibold text-foreground truncate">{sale.customer}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{sale.billNo}</p>
                      </div>
                      <span className="block text-sm font-bold text-foreground">{formatBDT(sale.total)}</span>
                    </div>
                    <button onClick={() => setViewing(sale as SaleType)} className="w-full h-9 rounded-lg bg-[hsl(45,65%,52%)] text-black text-xs font-semibold">
                      View Details
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page"
                  className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground">
                  Previous
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-next-page"
                  className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
