import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import TechniciansPage from "@/pages/technicians";
import RolesPage from "@/pages/roles";
import ServicePackagesPage from "@/pages/service-packages";
import AccountTypesPage from "@/pages/account-types";
import LocationsPage from "@/pages/locations";
import InspectionSettingsPage from "@/pages/inspection-settings";
import MonitorVehiclesPage from "@/pages/monitor-vehicles";
import MonitorInspectionsPage from "@/pages/monitor-inspections";
import MonitorJobsPage from "@/pages/monitor-jobs";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/technicians" component={TechniciansPage} />
        <Route path="/roles" component={RolesPage} />
        <Route path="/master/service-packages" component={ServicePackagesPage} />
        <Route path="/master/account-types" component={AccountTypesPage} />
        <Route path="/master/locations" component={LocationsPage} />
        <Route path="/master/inspection-settings" component={InspectionSettingsPage} />
        <Route path="/monitor/vehicles" component={MonitorVehiclesPage} />
        <Route path="/monitor/inspections" component={MonitorInspectionsPage} />
        <Route path="/monitor/jobs" component={MonitorJobsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppRouter() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppRouter />
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
