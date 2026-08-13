import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";

function ProtectedPortal() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Loading secure workspace…</div>;
  return user ? <Home /> : <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={ProtectedPortal} />
      <Route path={"/uploads"} component={ProtectedPortal} />
      <Route path={"/attendance"} component={ProtectedPortal} />
      <Route path={"/training"} component={ProtectedPortal} />
      <Route path={"/crew"} component={ProtectedPortal} />
      <Route path={"/login"} component={Login} />
      <Route path="/client/:token" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
