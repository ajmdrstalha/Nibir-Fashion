import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import BrandLogo from "@/components/BrandLogo";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  X,
  Package,
  Download,
  Upload,
  Settings,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/new-sale", label: "New Sale", icon: ShoppingCart },
  { path: "/sales-history", label: "Sales History", icon: History },
  { path: "/products", label: "Products", icon: Package },
  { path: "/settings", label: "Settings", icon: Settings },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col h-full w-[min(18rem,86vw)] lg:w-64 bg-[hsl(0,0%,4%)] text-[hsl(0,0%,92%)]">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(212,175,55,0.22)]">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="w-10 h-10 flex-shrink-0" />
          <span className="text-white font-bold text-lg tracking-tight">Nibir Fashion</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-[rgba(212,175,55,0.14)] transition-colors"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-5 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location === path;
          return (
            <Link
              key={path}
              href={path}
              onClick={onClose}
              data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 group
                ${isActive
                  ? "bg-[rgba(212,175,55,0.16)] text-white border-l-3 border-[hsl(45,65%,52%)]"
                  : "text-[hsl(0,0%,74%)] hover:bg-[rgba(212,175,55,0.10)] hover:text-white"
                }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? "text-[hsl(45,65%,52%)]" : "text-[hsl(0,0%,58%)] group-hover:text-[hsl(45,65%,52%)]"}`} />
              <span className="text-sm font-medium">{label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[hsl(45,65%,52%)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 space-y-2 border-t border-[rgba(212,175,55,0.22)] pt-4">
        <button
          onClick={toggleTheme}
          data-testid="button-toggle-theme"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[hsl(0,0%,74%)] hover:bg-[rgba(212,175,55,0.10)] hover:text-white transition-all duration-150 text-sm font-medium"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-7 h-7 rounded-full bg-[hsl(45,65%,52%)] flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-sm text-[hsl(0,0%,82%)] font-medium flex-1 truncate">
            {user?.email ?? "admin"}
          </span>
        </div>

        <button
          onClick={() => void logout()}
          data-testid="button-logout"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[hsl(0,84%,55%)] hover:bg-[hsl(0,84%,48%)] text-white transition-all duration-150 text-sm font-semibold"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const apiBase = import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";

  const pageTitle = navItems.find(n => n.path === location)?.label ?? "Dashboard";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleBackupDownload() {
    try {
      const response = await fetch(`${apiBase}/api/backup`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load backup");

      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `nibir-fashion-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded" });
    } catch {
      toast({ title: "Backup failed", description: "Could not export backup." });
    }
  }

  async function handleRestoreFile(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const response = await fetch(`${apiBase}/api/backup/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result && typeof result.error === "string" ? result.error : "Restore failed";
        throw new Error(message);
      }

      toast({ title: "Backup restored", description: "Refresh the page to load restored data." });
    } catch (error) {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Invalid backup file or server error.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <BrandLogo className="hidden sm:flex w-9 h-9 rounded-lg" />
            <h1 className="text-base sm:text-xl font-bold text-foreground truncate" data-testid="text-page-title">{pageTitle}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleBackupDownload}
              data-testid="button-backup-download"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              onClick={() => restoreInputRef.current?.click()}
              data-testid="button-backup-restore"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restore</span>
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleRestoreFile(file);
                }
                e.currentTarget.value = "";
              }}
            />
            <span className="text-sm text-muted-foreground font-medium hidden sm:block" data-testid="text-current-date">
              {dateStr}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
