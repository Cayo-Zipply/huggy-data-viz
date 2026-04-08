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
  FileText,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { key: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["admin", "sdr", "closer"] },
  { key: "/marketing", label: "Marketing", icon: BarChart3, roles: ["admin"] },
  { key: "/comercial", label: "Comercial", icon: Users, roles: ["admin"] },
  { key: "/comparativo", label: "Comparativo", icon: GitCompare, roles: ["admin"] },
  { key: "/rentabilidade", label: "Rentabilidade", icon: DollarSign, roles: ["admin"] },
  { key: "/consolidado", label: "Consolidado", icon: PieChart, roles: ["admin"] },
  { key: "/contratos", label: "Contratos", icon: FileText, roles: ["admin"] },
  { key: "/farol", label: "Farol", icon: Gauge, roles: ["admin"] },
  { key: "/usuarios", label: "Usuários", icon: UsersRound, roles: ["admin"] },
  { key: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
  { key: "/ajuda", label: "Ajuda", icon: HelpCircle, roles: ["admin", "sdr", "closer"] },
];

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = profile?.role ?? "closer";
  const filtered = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const initials = (profile?.nome ?? profile?.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-56 shrink-0 bg-sidebar-background border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">
          Pena Quadros
        </h1>
        <p className="text-[10px] text-muted-foreground">CRM</p>
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
              <Icon className="h-4 w-4" />
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
              {role}
            </p>
          </div>
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
