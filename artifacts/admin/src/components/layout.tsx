import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  Wrench,
  ShieldCheck,
  Package,
  CreditCard,
  MapPin,
  ClipboardList,
  Car,
  Search,
  Briefcase,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavSection {
  label: string;
  icon: ReactNode;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Access Control",
    icon: <ShieldCheck size={15} />,
    items: [
      { label: "Yard Users", href: "/users", icon: <Users size={15} /> },
      { label: "Technicians", href: "/technicians", icon: <Wrench size={15} /> },
      { label: "Roles & Permissions", href: "/roles", icon: <ShieldCheck size={15} /> },
    ],
  },
  {
    label: "Master Data",
    icon: <Package size={15} />,
    items: [
      { label: "Service Packages", href: "/master/service-packages", icon: <Package size={15} /> },
      { label: "Account Types", href: "/master/account-types", icon: <CreditCard size={15} /> },
      { label: "Locations", href: "/master/locations", icon: <MapPin size={15} /> },
      { label: "Inspection Settings", href: "/master/inspection-settings", icon: <ClipboardList size={15} /> },
    ],
  },
  {
    label: "System Monitor",
    icon: <Search size={15} />,
    items: [
      { label: "Vehicles", href: "/monitor/vehicles", icon: <Car size={15} /> },
      { label: "Inspections", href: "/monitor/inspections", icon: <ClipboardList size={15} /> },
      { label: "Jobs", href: "/monitor/jobs", icon: <Briefcase size={15} /> },
    ],
  },
];

function NavLink({ href, icon, label }: NavItem) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link href={href}>
      <a
        data-testid={`nav-link-${href.replace(/\//g, "-").replace(/^-/, "")}`}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {icon}
        {label}
      </a>
    </Link>
  );
}

function SectionNav({ section }: { section: NavSection }) {
  const [location] = useLocation();
  const isAnyActive = section.items.some((i) => location === i.href);
  const [open, setOpen] = useState(isAnyActive || true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
        data-testid={`nav-section-${section.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span>{section.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {section.items.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { userName, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-accent-foreground leading-tight">IGMMA DMS</p>
          <p className="text-xs text-sidebar-foreground/50">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <div>
          <NavLink href="/dashboard" icon={<LayoutDashboard size={15} />} label="Dashboard" />
        </div>
        {navSections.map((section) => (
          <SectionNav key={section.label} section={section} />
        ))}
        <div>
          <NavLink href="/settings" icon={<Settings size={15} />} label="System Settings" />
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{userName}</p>
            <p className="text-xs text-sidebar-foreground/50">Administrator</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0"
            data-testid="button-logout"
            title="Sign out"
          >
            <LogOut size={14} />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-sidebar flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-sidebar flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground"
            data-testid="button-mobile-menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">IGMMA DMS Admin</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
