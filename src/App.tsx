import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import { AppSidebar } from "@/components/AppSidebar";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile) {
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

            <Route
              path="/pipeline"
              element={
                <AuthGuard>
                  <Index initialTab="pipeline" />
                </AuthGuard>
              }
            />

            <Route
              path="/marketing"
              element={
                <AuthGuard>
                  <Index initialTab="marketing" />
                </AuthGuard>
              }
            />

            <Route
              path="/comercial"
              element={
                <AuthGuard>
                  <Index initialTab="comercial" />
                </AuthGuard>
              }
            />

            <Route
              path="/comparativo"
              element={
                <AuthGuard>
                  <Index initialTab="comparativo" />
                </AuthGuard>
              }
            />

            <Route
              path="/rentabilidade"
              element={
                <AuthGuard>
                  <RoleGuard roles={["admin"]}>
                    <Index initialTab="rentabilidade" />
                  </RoleGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/consolidado"
              element={
                <AuthGuard>
                  <RoleGuard roles={["admin"]}>
                    <Index initialTab="consolidado" />
                  </RoleGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/ajuda"
              element={
                <AuthGuard>
                  <Index initialTab="ajuda" />
                </AuthGuard>
              }
            />

            <Route path="/" element={<Navigate to="/pipeline" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

