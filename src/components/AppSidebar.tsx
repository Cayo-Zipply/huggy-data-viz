import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { AvatarUploader } from "@/components/AvatarUploader";
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
  Sparkles,
  Flame,
} from "lucide-react";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";


interface NavItem {
  key: string;
  label: string;
  icon: any;
  roles: string[];
}

const MENU_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { key: "/farol", label: "Farol", icon: Gauge, roles: ["admin", "sdr", "closer"] },
      { key: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["admin", "sdr", "closer"] },
      { key: "/pool", label: "Modo Pool", icon: Flame, roles: ["admin", "closer"] },
    ],
  },
  {
    label: "ANÁLISE",
    items: [
      { key: "/marketing", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
      { key: "/comparativo", label: "Comparativo", icon: GitCompare, roles: ["admin"] },
      { key: "/rentabilidade", label: "Rentabilidade", icon: DollarSign, roles: ["admin"] },
      { key: "/consolidado", label: "Consolidado", icon: PieChart, roles: ["admin"] },
    ],
  },
  {
    label: "PERFORMANCE",
    items: [
      { key: "/sales-enablement", label: "Black Ops", icon: Sparkles, roles: ["admin", "sdr", "closer"] },
      { key: "/material-apoio", label: "Material de Apoio", icon: BookOpen, roles: ["admin", "sdr", "closer"] },
    ],
  },
  {
    label: "ADMINISTRAÇÃO",
    items: [
      { key: "/contratos", label: "Contratos", icon: FileText, roles: ["admin", "sdr", "closer"] },
      { key: "/usuarios", label: "Usuários", icon: UsersRound, roles: ["admin"] },
      { key: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
    ],
  },
  {
    label: "SUPORTE",
    items: [
      { key: "/feedbacks", label: "Feedbacks", icon: MessageSquarePlus, roles: ["admin"] },
      { key: "/ajuda", label: "Ajuda", icon: HelpCircle, roles: ["admin", "sdr", "closer"] },
    ],
  },
];

export function AppSidebar() {
  const { profile, signOut, isSdr, isCloser, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = profile?.role ?? "closer";
  const secondaryRole = profile?.secondary_role;
  const canSee = (item: NavItem) => {
    if (item.roles.includes("admin") && isAdmin) return true;
    if (item.roles.includes("sdr") && isSdr) return true;
    if (item.roles.includes("closer") && isCloser) return true;
    if (item.roles.includes(role)) return true;
    if (secondaryRole && item.roles.includes(secondaryRole)) return true;
    return false;
  };
  const visibleGroups = MENU_GROUPS
    .map((group) => ({ ...group, items: group.items.filter(canSee) }))
    .filter((group) => group.items.length > 0);
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
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="mx-4 my-3 border-t border-sidebar-border/60" />}
            <p className="px-4 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 select-none">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-3">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <AvatarUploader
            initials={initials}
            currentUrl={(profile as any)?.avatar_url ?? null}
          />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {profile?.nome ?? profile?.email ?? "Usuário"}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {secondaryRole ? `${role} + ${secondaryRole}` : role}
            </p>
          </div>
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
