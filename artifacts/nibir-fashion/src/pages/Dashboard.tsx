import { useState, useMemo } from "react";
import { CalendarDays, ShoppingBag, TrendingUp, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useGetTodaySummary,
  useGetMonthSummary,
  useGetMonthlyTotals,
  useListSales,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatBDT(amount: number) {
  return `BDT ${Number(amount).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

interface SaleType {
  id: number;
  billNo: string;
  date: string;
  customer: string;
  total: number;
  items: { name: string; size: string; qty: number; rate: number; amount: number }[];
}

function SummaryCard({ title, amount, count, icon: Icon, iconBg, isLoading }: {
  title: string; amount: number; count: number;
  icon: React.ElementType; iconBg: string; isLoading?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          {isLoading ? (
            <div className="h-8 w-32 bg-muted animate-pulse rounded-lg mb-1" />
          ) : (
            <p className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight break-words">{formatBDT(amount)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {isLoading ? "..." : `${count} ${count === 1 ? "sale" : "sales"}`}
          </p>
        </div>
      </div>
    </div>
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function CalendarSection({ allSales }: { allSales: SaleType[] }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const salesByDate = useMemo(() => {
    const map: Record<string, SaleType[]> = {};
    for (const sale of allSales) {
      if (!map[sale.date]) map[sale.date] = [];
      map[sale.date].push(sale);
    }
    return map;
  }, [allSales]);

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  };

  const selectedSales = selectedDate ? (salesByDate[selectedDate] ?? []) : [];
  const selectedTotal = selectedSales.reduce((s, sale) => s + sale.total, 0);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[hsl(45,65%,52%)]" />
            Sales Calendar
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[110px] text-center">
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
            const hasSales = !!salesByDate[dateStr];
            const dayTotal = hasSales ? salesByDate[dateStr].reduce((s, sale) => s + sale.total, 0) : 0;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-all duration-150 min-h-[44px]
                  ${isSelected
                    ? "bg-[hsl(45,65%,52%)] text-black shadow-md"
                    : isToday
                      ? "bg-[hsl(45,65%,52%)] text-black"
                      : hasSales
                        ? "bg-[hsl(45,65%,92%)] dark:bg-[hsl(45,50%,16%)] text-[hsl(43,89%,28%)] dark:text-[hsl(45,75%,68%)] hover:bg-[hsl(45,65%,84%)] dark:hover:bg-[hsl(45,50%,22%)]"
                        : "text-foreground hover:bg-muted"
                  }`}
              >
                <span>{day}</span>
                {hasSales && !isSelected && (
                  <span className={`text-[9px] font-bold mt-0.5 ${isToday ? "text-white/80" : "text-[hsl(45,65%,52%)] dark:text-[hsl(45,75%,62%)]"}`}>
                    {dayTotal >= 1000 ? `${(dayTotal / 1000).toFixed(1)}k` : dayTotal.toFixed(0)}
                  </span>
                )}
                {hasSales && (
                  <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${isSelected || isToday ? "bg-white/70" : "bg-[hsl(45,65%,52%)]"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date sales panel */}
        {selectedDate && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-foreground">{selectedDate}</p>
                <p className="text-xs text-muted-foreground">{selectedSales.length} sale{selectedSales.length !== 1 ? "s" : ""} · {formatBDT(selectedTotal)}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No sales on this date</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {selectedSales.map(sale => (
                  <div key={sale.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border border-border">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{sale.billNo}</p>
                      <p className="text-[11px] text-muted-foreground">{sale.customer} · {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-extrabold text-foreground">{formatBDT(sale.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[hsl(45,65%,52%)]" />
            Today
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[hsl(45,65%,92%)] dark:bg-[hsl(45,50%,16%)]" />
            Has sales
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[hsl(45,65%,52%)]" />
            Selected
          </div>
        </div>
      </div>
    </div>
  );
}

function DailySalesReport({ sales }: { sales: SaleType[] }) {
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  const todaySales = sales.filter(s => s.date === today);
  const total = todaySales.reduce((s, sale) => s + sale.total, 0);

  return (
    <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[hsl(45,65%,52%)]" />
          Today's Sales Report
        </h2>
        {todaySales.length > 0 && (
          <span className="text-sm font-extrabold text-[hsl(45,65%,52%)]">{formatBDT(total)}</span>
        )}
      </div>

      {todaySales.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No sales recorded today yet
        </div>
      ) : (
        <>
        <table className="hidden md:table w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Bill No</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Customer</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Items</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {todaySales.map((sale, i) => (
              <tr key={sale.id} className={`${i < todaySales.length - 1 ? "border-b border-border/60" : ""} hover:bg-muted/30 transition-colors`}>
                <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{sale.billNo}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-foreground">{sale.customer}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {sale.items.map(it => it.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-sm font-bold text-foreground text-right">{formatBDT(sale.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20">
              <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{todaySales.length} transaction{todaySales.length !== 1 ? "s" : ""}</td>
              <td className="px-4 py-2.5 text-sm font-extrabold text-foreground text-right">{formatBDT(total)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="md:hidden divide-y divide-border">
          {todaySales.map((sale) => (
            <div key={sale.id} className="px-4 py-3 space-y-2">
              <div className="space-y-1">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-muted-foreground">{sale.billNo}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{sale.customer}</p>
                </div>
                <span className="block text-sm font-bold text-foreground">{formatBDT(sale.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {sale.items.map(it => it.name).join(", ") || "No items"}
              </p>
            </div>
          ))}
          <div className="px-4 py-3 bg-muted/20 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">{todaySales.length} transaction{todaySales.length !== 1 ? "s" : ""}</span>
            <span className="block text-sm font-extrabold text-foreground">{formatBDT(total)}</span>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const now = new Date();
  const [selectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const { data: todaySummary, isLoading: todayLoading } = useGetTodaySummary();
  const { data: monthSummary, isLoading: monthLoading } = useGetMonthSummary();
  const { data: monthlyTotals, isLoading: chartLoading } = useGetMonthlyTotals(
    { year: selectedYear },
    { query: { queryKey: ["monthly-totals", selectedYear] } }
  );
  const { data: reportSales = [] } = useListSales(
    { year: selectedYear, month: selectedMonth },
    { query: { queryKey: ["sales", selectedYear, selectedMonth] } }
  );
  const { data: allSales = [] } = useListSales(
    { year: selectedYear },
    { query: { queryKey: ["sales-year", selectedYear] } }
  );

  const reportSalesList = Array.isArray(reportSales) ? reportSales : [];
  const allSalesList = Array.isArray(allSales) ? allSales : [];
  const monthlyTotalsList = Array.isArray(monthlyTotals) ? monthlyTotals : [];

  const reportTotal = reportSalesList.reduce((s, sale) => s + sale.total, 0);
  const reportMonthLabel = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const selectedMonthName = MONTHS[selectedMonth - 1];

  const chartData = chartLoading ? [] : monthlyTotalsList.map(m => ({ month: m.month, total: m.total }));

  return (
    <div className="space-y-4 sm:space-y-5 max-w-6xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          title="Today Sales"
          amount={todaySummary?.total ?? 0}
          count={todaySummary?.count ?? 0}
          icon={ShoppingBag}
          iconBg="bg-[hsl(45,65%,52%)]"
          isLoading={todayLoading}
        />
        <SummaryCard
          title="This Month Sales"
          amount={monthSummary?.total ?? 0}
          count={monthSummary?.count ?? 0}
          icon={TrendingUp}
          iconBg="bg-[hsl(45,65%,52%)]"
          isLoading={monthLoading}
        />
      </div>

      {/* Today's sales report + Calendar side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 lg:gap-5">
        <DailySalesReport sales={allSalesList as SaleType[]} />
        <CalendarSection allSales={allSalesList as SaleType[]} />
      </div>

      {/* Monthly report + chart */}
      <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-base font-semibold text-foreground">Monthly Sales Report</h2>

          <div className="relative">
            <button
              onClick={() => setMonthPickerOpen(o => !o)}
              data-testid="button-month-picker"
              className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[hsl(45,65%,52%)] hover:bg-[hsl(43,89%,38%)] text-black hover:text-white text-sm font-medium transition-colors duration-150 shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              {selectedMonthName} {selectedYear}
            </button>

            {monthPickerOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-card-border rounded-2xl shadow-lg p-3 w-56 max-w-[calc(100vw-2rem)]">
                <p className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wide">Select Month</p>
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS.map((m, i) => {
                    const monthNum = i + 1;
                    const isSelected = monthNum === selectedMonth;
                    return (
                      <button
                        key={m}
                        onClick={() => { setSelectedMonth(monthNum); setMonthPickerOpen(false); }}
                        data-testid={`button-month-${monthNum}`}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-[hsl(45,65%,52%)] text-black"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {SHORT_MONTHS[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-background border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[hsl(45,65%,92%)] dark:bg-[hsl(45,50%,18%)] flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 text-[hsl(45,65%,52%)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Report Total</p>
                <p className="text-xl font-extrabold text-foreground tracking-tight">{formatBDT(reportTotal)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{reportSales.length} sales</p>
              </div>
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[hsl(45,65%,92%)] dark:bg-[hsl(45,50%,18%)] flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-4 h-4 text-[hsl(45,65%,52%)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Report Month</p>
                <p className="text-xl font-extrabold text-foreground tracking-tight">{reportMonthLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Selected month</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-4">Monthly Sales Overview — {selectedYear}</p>
          <div className="min-w-0 overflow-x-auto">
          <div className="min-w-[520px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number) => [formatBDT(value), "Sales"]}
                cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
              />
              <Bar dataKey="total" fill="hsl(45,65%,52%)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
