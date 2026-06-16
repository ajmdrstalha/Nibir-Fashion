export interface Sale {
  id: string;
  date: string;
  customer: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  paymentMethod: "Cash" | "Card" | "Mobile";
}

const ITEMS = [
  "Slim Fit Jeans",
  "Floral Dress",
  "Polo Shirt",
  "Bomber Jacket",
  "Linen Trousers",
  "Knit Sweater",
  "Cargo Pants",
  "Maxi Skirt",
  "Denim Jacket",
  "Sports Tee",
];

function randomItem() {
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice() {
  return randomBetween(300, 5000);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function generateMonthlySales(year: number, month: number): Sale[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const sales: Sale[] = [];
  let id = 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const numSales = randomBetween(0, 6);
    const customers = ["Rahul Ahmed", "Priya Sen", "Karim Hossain", "Nadia Islam", "Tanvir Alam", "Sumaiya Begum", "Arif Khan", "Rupa Das"];
    const methods: ("Cash" | "Card" | "Mobile")[] = ["Cash", "Card", "Mobile"];

    for (let s = 0; s < numSales; s++) {
      const numItems = randomBetween(1, 3);
      const items = Array.from({ length: numItems }, () => ({
        name: randomItem(),
        qty: randomBetween(1, 3),
        price: randomPrice(),
      }));
      const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

      sales.push({
        id: `SALE-${year}${pad(month)}${pad(day)}-${String(id).padStart(3, "0")}`,
        date: `${year}-${pad(month)}-${pad(day)}`,
        customer: customers[randomBetween(0, customers.length - 1)],
        items,
        total,
        paymentMethod: methods[randomBetween(0, 2)],
      });
      id++;
    }
  }

  return sales;
}

let seedSales: Sale[] | null = null;

export function getAllSales(): Sale[] {
  if (seedSales) return seedSales;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const results: Sale[] = [];

  for (let m = 1; m <= currentMonth; m++) {
    const sales = generateMonthlySales(currentYear, m);
    results.push(...sales);
  }

  seedSales = results;
  return results;
}

export function getSalesByMonth(year: number, month: number): Sale[] {
  const all = getAllSales();
  const prefix = `${year}-${pad(month)}`;
  return all.filter(s => s.date.startsWith(prefix));
}

export function getTodaySales(): Sale[] {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return getAllSales().filter(s => s.date === today);
}

export function getMonthlyTotals(year: number): { month: string; total: number; count: number }[] {
  const all = getAllSales();
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  return months.map((label, i) => {
    const monthNum = i + 1;
    const prefix = `${year}-${pad(monthNum)}`;
    const monthSales = all.filter(s => s.date.startsWith(prefix));
    return {
      month: label,
      total: monthSales.reduce((sum, s) => sum + s.total, 0),
      count: monthSales.length,
    };
  });
}
