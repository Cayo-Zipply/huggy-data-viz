import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import Contratos from "@/pages/Contratos";
import Feedbacks from "@/pages/Feedbacks";
import { AppSidebar } from "@/components/AppSidebar";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { useState } from "react";
import { Users, UserCheck } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: 60_000,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

const TAB_ROUTES = new Set(["pipeline", "marketing", "comercial", "comparativo", "rentabilidade", "consolidado", "ajuda", "farol"]);
const ADMIN_TABS = new Set(["marketing", "comercial", "comparativo", "rentabilidade", "consolidado", "farol"]);

function AuthLayout() {
  const { user, profile, loading, signOut, setRole } = useAuth();
  const [selecting, setSelecting] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile || profile.role === null) {
    if (profile && profile.role === null) {
      const handleSelect = async (role: "sdr" | "closer") => {
        setSelecting(true);
        await setRole(role);
        setSelecting(false);
      };

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto text-primary-foreground text-2xl font-bold">
              PQ
            </div>
            <h1 className="text-xl font-bold text-foreground">Bem-vindo ao CRM!</h1>
            <p className="text-muted-foreground text-sm">
              Selecione seu papel para continuar:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelect("sdr")}
                disabled={selecting}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <Users className="h-8 w-8 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">SDR</span>
                <span className="text-xs text-muted-foreground">Pré-vendas</span>
              </button>
              <button
                onClick={() => handleSelect("closer")}
                disabled={selecting}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <UserCheck className="h-8 w-8 text-green-500" />
                <span className="text-sm font-semibold text-foreground">Closer</span>
                <span className="text-xs text-muted-foreground">Fechamento</span>
              </button>
            </div>
            <button
              onClick={() => signOut()}
              className="text-xs text-muted-foreground hover:underline"
            >
              Sair
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground text-sm">
            Perfil não encontrado. Solicite acesso ao administrador.
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm text-primary hover:underline"
          >
            Sair e tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const currentTab = location.pathname.replace("/", "") || "pipeline";
  const isTabRoute = TAB_ROUTES.has(currentTab);
  const isAdminTab = ADMIN_TABS.has(currentTab);

  if (isAdminTab && profile.role !== "admin") {
    return <Navigate to="/pipeline" replace />;
  }

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        {/* Index stays mounted — tabs switch via CSS visibility */}
        <div className={isTabRoute ? "" : "hidden"}>
          <Index />
        </div>
        {/* Non-tab pages render via Outlet */}
        {!isTabRoute && <Outlet />}
      </main>
      <FeedbackWidget />
    </div>
  );
}

function RoleGuard({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/pipeline" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AuthLayout />}>
              <Route path="/pipeline" element={null} />
              <Route path="/marketing" element={null} />
              <Route path="/comercial" element={null} />
              <Route path="/comparativo" element={null} />
              <Route path="/rentabilidade" element={null} />
              <Route path="/consolidado" element={null} />
              <Route path="/ajuda" element={null} />
              <Route path="/farol" element={null} />

              <Route path="/usuarios" element={<RoleGuard roles={["admin"]}><UserManagement /></RoleGuard>} />
              <Route path="/contratos" element={<RoleGuard roles={["admin"]}><Contratos /></RoleGuard>} />
              <Route path="/configuracoes" element={<RoleGuard roles={["admin"]}><Settings /></RoleGuard>} />
              <Route path="/feedbacks" element={<RoleGuard roles={["admin"]}><Feedbacks /></RoleGuard>} />
            </Route>

            <Route path="/" element={<Navigate to="/pipeline" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
