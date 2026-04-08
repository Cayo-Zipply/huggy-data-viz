import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import Contratos from "@/pages/Contratos";
import { AppSidebar } from "@/components/AppSidebar";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { useState } from "react";
import { Users, UserCheck } from "lucide-react";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut, setRole } = useAuth();
  const [selecting, setSelecting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile || profile.role === null) {
    // Profile exists but no role yet — show role picker
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

    // No profile at all
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

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 min-w-0">{children}</main>
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

const TAB_ROUTES = ["/pipeline", "/marketing", "/comercial", "/comparativo", "/rentabilidade", "/consolidado", "/ajuda", "/farol"];
const ADMIN_TABS = ["/marketing", "/comercial", "/comparativo", "/rentabilidade", "/consolidado", "/farol"];

const pathToTab = (p: string) => p.replace("/", "") || "pipeline";

function IndexLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  const tab = pathToTab(location.pathname);

  if (ADMIN_TABS.includes(location.pathname) && profile?.role !== "admin") {
    return <Navigate to="/pipeline" replace />;
  }

  return <Index initialTab={tab} />;
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

            <Route
              path="/usuarios"
              element={
                <AuthGuard>
                  <RoleGuard roles={["admin"]}>
                    <UserManagement />
                  </RoleGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/contratos"
              element={
                <AuthGuard>
                  <RoleGuard roles={["admin"]}>
                    <Contratos />
                  </RoleGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/configuracoes"
              element={
                <AuthGuard>
                  <RoleGuard roles={["admin"]}>
                    <Settings />
                  </RoleGuard>
                </AuthGuard>
              }
            />

            {TAB_ROUTES.map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <AuthGuard>
                    <IndexLayout />
                  </AuthGuard>
                }
              />
            ))}

            <Route path="/" element={<Navigate to="/pipeline" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
