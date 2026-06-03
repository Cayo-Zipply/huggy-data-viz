import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart3,
  Users,
  GitCompare,
  DollarSign,
  PieChart,
  Kanban,
  LogOut,
  HelpCircle,
  UsersRound,
  Settings,
  MessageSquarePlus,
  FileText,
  Gauge,
  BookOpen,
  KeyRound,
} from "lucide-react";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const NAV_ITEMS = [
  { key: "/farol", label: "Farol", icon: Gauge, roles: ["admin", "sdr", "closer"] },
  { key: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["admin", "sdr", "closer"] },
  { key: "/marketing", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
  { key: "/comparativo", label: "Comparativo", icon: GitCompare, roles: ["admin"] },
  { key: "/rentabilidade", label: "Rentabilidade", icon: DollarSign, roles: ["admin"] },
  { key: "/consolidado", label: "Consolidado", icon: PieChart, roles: ["admin"] },
  { key: "/contratos", label: "Contratos", icon: FileText, roles: ["admin", "sdr", "closer"] },
  { key: "/usuarios", label: "Usuários", icon: UsersRound, roles: ["admin"] },
  { key: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
  { key: "/feedbacks", label: "Feedbacks", icon: MessageSquarePlus, roles: ["admin"] },
  { key: "/material-apoio", label: "Material de Apoio", icon: BookOpen, roles: ["admin", "sdr", "closer"] },
  { key: "/ajuda", label: "Ajuda", icon: HelpCircle, roles: ["admin", "sdr", "closer"] },
];

export function AppSidebar() {
  const { profile, signOut, isSdr, isCloser, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = profile?.role ?? "closer";
  const secondaryRole = profile?.secondary_role;
  const filtered = NAV_ITEMS.filter((item) => {
    if (item.roles.includes("admin") && isAdmin) return true;
    if (item.roles.includes("sdr") && isSdr) return true;
    if (item.roles.includes("closer") && isCloser) return true;
    if (item.roles.includes(role)) return true;
    if (secondaryRole && item.roles.includes(secondaryRole)) return true;
    return false;
  });
  const initials = (profile?.nome ?? profile?.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-56 shrink-0 bg-sidebar-background border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <img src="/brand/farol-icon.svg" alt="" className="h-8 w-8 hidden dark:block" />
        <img src="/brand/farol-icon-mono.svg" alt="" className="h-8 w-8 dark:hidden block" />
        <div className="leading-tight">
          <h1 className="font-serif-display text-base text-sidebar-foreground">O FAROL</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-primary">Pena Quadros</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
        {filtered.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-3">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {profile?.nome ?? profile?.email ?? "Usuário"}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {secondaryRole ? `${role} + ${secondaryRole}` : role}
            </p>
          </div>
          <NotificationBell />
          <ChangePasswordDialog>
            <button
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Alterar senha"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          </ChangePasswordDialog>
          <button
            onClick={() => signOut()}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
