import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="text-6xl font-bold text-muted-foreground">404</div>
      <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
      <p className="text-muted-foreground text-sm">The page you are looking for does not exist.</p>
      <Link href="/" className="text-primary hover:underline text-sm font-medium">
        Back to Dashboard
      </Link>
    </div>
  );
}
