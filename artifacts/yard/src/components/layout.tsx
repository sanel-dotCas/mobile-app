import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useYardLogout } from "@workspace/api-client-react";
import { LayoutDashboard, MapPin, Car, ClipboardCheck, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/locations", icon: MapPin, label: "Locations" },
  { href: "/inventory", icon: Car, label: "Inventory" },
  { href: "/inspections", icon: ClipboardCheck, label: "Inspections" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logoutMutation = useYardLogout({
    mutation: { onSuccess: () => logout() },
  });

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-56 bg-sidebar border-r border-sidebar-border transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-[hsl(221,83%,53%)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-4.724A1 1 0 013 14.382V5a1 1 0 011-1h7.586a1 1 0 01.707.293l7 7a1 1 0 010 1.414l-5.293 5.293a1 1 0 01-1.414 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sidebar-foreground text-sm font-semibold leading-tight">Yard Manager</p>
            <p className="text-[hsl(215,20%,50%)] text-[10px]">IGMMA DMS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${label.toLowerCase()}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                isActive(href)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-[hsl(215,20%,65%)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-sidebar-border shrink-0">
          <div className="px-3 py-2 mb-1">
            <p className="text-sidebar-foreground text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[hsl(215,20%,50%)] text-[10px] capitalize">{user?.role?.replace("_", " ")}</p>
          </div>
          <button
            data-testid="button-logout"
            onClick={() => logoutMutation.mutate({})}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded text-sm text-[hsl(215,20%,65%)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b bg-sidebar border-sidebar-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[hsl(215,20%,65%)] hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium">Yard Manager</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
