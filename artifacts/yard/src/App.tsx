import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LocationsPage from "@/pages/locations";
import LocationDetailPage from "@/pages/location-detail";
import InventoryPage from "@/pages/inventory";
import InspectionsPage from "@/pages/inspections";
import TransfersPage from "@/pages/transfers";
import ServicePackagesPage from "@/pages/service-packages";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[hsl(221,83%,53%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <Switch>
      <Route path="/login">
        {!isLoading && isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/locations" component={() => <ProtectedRoute component={LocationsPage} />} />
      <Route path="/locations/:locationId" component={() => <ProtectedRoute component={LocationDetailPage} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={InventoryPage} />} />
      <Route path="/inspections" component={() => <ProtectedRoute component={InspectionsPage} />} />
      <Route path="/transfers" component={() => <ProtectedRoute component={TransfersPage} />} />
      <Route path="/service-packages" component={() => <ProtectedRoute component={ServicePackagesPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
