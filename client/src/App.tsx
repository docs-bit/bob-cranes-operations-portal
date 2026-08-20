import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RentalLanding from "./pages/RentalLanding";
import RuntimeErrorReporter from "./components/RuntimeErrorReporter";
import PerformanceTelemetry from "./components/PerformanceTelemetry";

function ProtectedPortal() {
  const { user, loading, refresh } = useAuth();
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsSlow(false);
      return;
    }
    const timeout = window.setTimeout(() => setIsSlow(true), 3200);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  if (loading) return <div className="auth-loading" role="status" aria-live="polite"><div className="auth-loading-card"><div className="auth-brand-mark auth-brand-logo"><img src="/assets/bob-logo.webp" alt="BOB Cranes — Lifting Your Expectations" /></div><span className="auth-spinner" aria-hidden="true" /><strong>Loading secure workspace</strong><span>Checking your BOB Cranes access and saved session.</span>{isSlow && <button className="secondary-button" onClick={() => void refresh()}>Retry secure connection</button>}</div></div>;
  return user ? <Home /> : <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={RentalLanding} />
      <Route path={"/portal"} component={ProtectedPortal} />
      <Route path={"/uploads"} component={ProtectedPortal} />
      <Route path={"/attendance"} component={ProtectedPortal} />
      <Route path={"/training"} component={ProtectedPortal} />
      <Route path={"/crew"} component={ProtectedPortal} />
      <Route path={"/gear"} component={ProtectedPortal} />
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
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <RuntimeErrorReporter />
          <PerformanceTelemetry />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
