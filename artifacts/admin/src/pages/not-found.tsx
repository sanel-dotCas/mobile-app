import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground" data-testid="heading-not-found">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">The page you are looking for does not exist.</p>
        <Link href="/dashboard">
          <Button data-testid="link-go-dashboard">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
