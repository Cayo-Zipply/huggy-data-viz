import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { cn } from "@/lib/utils";
import { locationFlags } from "@/lib/presenceGeolocation";

interface PresenceRow {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  status: "ativo" | "ausente" | "offline";
  last_seen: string | null;
  ultima_interacao: string | null;
  primeiro_acesso_hoje: string | null;
  minutos_sem_interacao: number | null;
  latitude: number | null;
  longitude: number | null;
  precisao_m: number | null;
  localizacao_at: string | null;
  geo_status: "concedida" | "negada" | "indisponivel" | "pendente" | null;
  mapa_url: string | null;
}

const TZ = "America/Sao_Paulo";

function fmtHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtLastSeen(iso: string | null): string {
  if (!iso) return "Sem acesso registrado";
  const d = new Date(iso);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: TZ });
  const dia = d.toLocaleDateString("pt-BR", { timeZone: TZ });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  if (dia === hoje) return `Visto por último às ${hora}`;
  const dm = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  return `Visto por último em ${dm} ${hora}`;
}

function apoio(r: PresenceRow): string {
  if (r.status === "ativo") return "Ativo agora";
  if (r.status === "ausente") return `Ausente há ${r.minutos_sem_interacao ?? 0} min`;
  return fmtLastSeen(r.last_seen);
}

const DOT: Record<string, string> = {
  ativo: "bg-green-500",
  ausente: "bg-amber-400",
  offline: "bg-muted-foreground/40",
};

function PresenceLocation({ row }: { row: PresenceRow }) {
  if (row.geo_status === "negada") {
    return <span className="text-xs text-destructive">Localização negada</span>;
  }
  if (row.geo_status === "indisponivel") {
    return <span className="text-xs text-muted-foreground">Localização indisponível</span>;
  }
  if (row.geo_status !== "concedida") return <span className="text-xs text-muted-foreground">—</span>;
  const flags = locationFlags(row.precisao_m, row.localizacao_at);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span aria-hidden="true">📍</span>
      {row.mapa_url && <a href={row.mapa_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Ver no mapa</a>}
      {row.precisao_m !== null && <span>± {Math.round(row.precisao_m)} m</span>}
      {row.localizacao_at && <span>atualizada às {fmtHora(row.localizacao_at)}</span>}
      {flags.imprecisa && <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-warning">imprecisa</span>}
      {flags.desatualizada && <span className="rounded border border-border bg-muted px-1.5 py-0.5">desatualizada</span>}
    </div>
  );
}

export default function EquipeOnline() {
  const [filtroRole, setFiltroRole] = useState<string>("todos");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["presence_status_admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("presence_status_admin");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as PresenceRow[];
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const rows = (data ?? []).filter((r) => r.nome !== "IA Kommo");
  const roles = Array.from(new Set(rows.map((r) => r.role).filter(Boolean)));
  const filtradas = filtroRole === "todos" ? rows : rows.filter((r) => r.role === filtroRole);

  const ativos = rows.filter((r) => r.status === "ativo").length;
  const ausentes = rows.filter((r) => r.status === "ausente").length;
  const offline = rows.filter((r) => r.status === "offline").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Equipe online</h1>
          <p className="text-sm text-muted-foreground">
            Presença dos usuários em tempo real{isFetching && !isLoading ? " · atualizando…" : ""}
          </p>
        </div>
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
          className="text-sm bg-card border border-border rounded-md px-3 py-1.5 text-foreground"
        >
          <option value="todos">Todas as funções</option>
          {roles.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">🟢 {ativos}</p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">🟡 {ausentes}</p>
          <p className="text-xs text-muted-foreground">Ausentes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">⚫ {offline}</p>
          <p className="text-xs text-muted-foreground">Offline</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <div className="space-y-2">
          {filtradas.map((r) => (
            <div
              key={r.user_id}
              className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[r.status] ?? DOT.offline)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{r.nome}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
                    {r.role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{apoio(r)}</p>
                <PresenceLocation row={r} />
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                Primeiro acesso hoje: {fmtHora(r.primeiro_acesso_hoje)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
