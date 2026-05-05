import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";

// Lazy-load pages
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import TechniciansPage from "@/pages/technicians";
import RolesPage from "@/pages/roles";
import ServicePackagesPage from "@/pages/service-packages";
import AccountTypesPage from "@/pages/account-types";
import LocationsPage from "@/pages/locations";
import MonitorVehiclesPage from "@/pages/monitor-vehicles";
import MonitorInspectionsPage from "@/pages/monitor-inspections";
import MonitorJobsPage from "@/pages/monitor-jobs";
import SettingsPage from "@/pages/settings";
import SystemStatusPage from "@/pages/system-status";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={UsersPage} />
        <Route path="/technicians" component={TechniciansPage} />
        <Route path="/roles" component={RolesPage} />
        <Route path="/master/service-packages" component={ServicePackagesPage} />
        <Route path="/master/account-types" component={AccountTypesPage} />
        <Route path="/master/locations" component={LocationsPage} />
        <Route path="/monitor/vehicles" component={MonitorVehiclesPage} />
        <Route path="/monitor/inspections" component={MonitorInspectionsPage} />
        <Route path="/monitor/jobs" component={MonitorJobsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/system-status" component={SystemStatusPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/:rest*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <AuthProvider>
            <Router />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
