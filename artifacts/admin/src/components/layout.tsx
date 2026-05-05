import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  Shield, 
  Package, 
  Tag, 
  MapPin, 
  Car, 
  ClipboardCheck, 
  Briefcase, 
  Settings,
  Activity,
  LogOut,
  Menu,
  X,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItemProps {
  href: string;
  icon: any;
  title: string;
  active?: boolean;
}

const NavItem = ({ href, icon: Icon, title, active }: NavItemProps) => (
  <Link href={href}>
    <a className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
      active 
        ? "bg-blue-600 text-white" 
        : "text-slate-400 hover:text-white hover:bg-slate-800"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
      <span className="font-medium">{title}</span>
    </a>
  </Link>
);

const SectionHeader = ({ title }: { title: string }) => (
  <h3 className="px-3 mt-6 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
    {title}
  </h3>
);

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation: any[] = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { 
      section: "ACCESS CONTROL",
      items: [
        { title: "Users", href: "/users", icon: Users },
        { title: "Technicians", href: "/technicians", icon: Wrench },
        { title: "Roles & Permissions", href: "/roles", icon: Shield },
      ]
    },
    {
      section: "MASTER DATA",
      items: [
        { title: "Service Packages", href: "/master/service-packages", icon: Package },
        { title: "Account Types", href: "/master/account-types", icon: Tag },
        { title: "Locations", href: "/master/locations", icon: MapPin },
      ]
    },
    {
      section: "MONITOR",
      items: [
        { title: "Vehicles", href: "/monitor/vehicles", icon: Car },
        { title: "Inspections", href: "/monitor/inspections", icon: ClipboardCheck },
        { title: "Jobs", href: "/monitor/jobs", icon: Briefcase },
      ]
    },
    {
      section: "SYSTEM",
      items: [
        { title: "Settings", href: "/settings", icon: Settings },
        { title: "System Status", href: "/system-status", icon: Activity },
      ]
    }
  ];

  const getPageTitle = () => {
    for (const item of navigation) {
      if (item.href === location) return item.title;
      if (item.items) {
        const subItem = item.items.find((si: any) => si.href === location);
        if (subItem) return subItem.title;
      }
    }
    return "Dashboard";
  };

  const renderNavItems = (items: any[]) => {
    return items.map((item, idx) => {
      if (item.section) {
        return (
          <div key={idx}>
            <SectionHeader title={item.section} />
            {item.items?.map((subItem: any) => (
              <NavItem 
                key={subItem.href} 
                href={subItem.href} 
                icon={subItem.icon} 
                title={subItem.title}
                active={location === subItem.href}
              />
            ))}
          </div>
        );
      }
      return (
        <NavItem 
          key={item.href} 
          href={item.href} 
          icon={item.icon} 
          title={item.title}
          active={location === item.href}
        />
      );
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0f172a] text-white fixed inset-y-0">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-500" />
            IGMMA Admin
          </h1>
        </div>
        
        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-1">
            {renderNavItems(navigation)}
          </nav>
        </ScrollArea>

        <div className="p-4 bg-slate-900/50 mt-auto">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 border border-slate-700">
              <AvatarFallback className="bg-blue-600 text-white">
                {user?.name?.[0] || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-white hover:bg-slate-800">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-slate-200 lg:px-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden mr-2" 
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </Button>
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-900">{user?.name}</span>
              <span className="text-xs text-slate-500 capitalize">{user?.role}</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-slate-100 text-slate-600">
                {user?.name?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-[#0f172a] text-white flex flex-col">
            <div className="p-4 flex items-center justify-between">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-500" />
                IGMMA Admin
              </h1>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6" />
              </Button>
            </div>
            <ScrollArea className="flex-1 px-3">
              <nav className="space-y-1">
                {renderNavItems(navigation)}
              </nav>
            </ScrollArea>
            <div className="p-4 border-t border-slate-800">
               <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white" onClick={logout}>
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
