import { useEffect, useState, useCallback } from "react";
import { Bell, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseExternal";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Recipient {
  id: string;
  read_at: string | null;
  created_at: string;
  notification: {
    id: string;
    title: string;
    message: string;
    created_by_nome: string | null;
    created_at: string;
    lead_id: string | null;
    tipo: string | null;
  } | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const PAGE_SIZE = 20;

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Recipient[]>([]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (pageIdx: number, replace: boolean) => {
    if (!user?.id) return;
    setLoadingMore(true);
    const from = pageIdx * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("notification_recipients" as any)
      .select(
        "id, read_at, created_at, notification:notifications(id, title, message, created_by_nome, created_at, lead_id, tipo)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    setLoadingMore(false);
    if (error) {
      console.warn("notif fetch:", error.message);
      return;
    }
    const rows = (data as any) ?? [];
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => (replace ? rows : [...prev, ...rows]));
  }, [user?.id]);

  const refresh = useCallback(() => {
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => {
    if (!user?.id) return;
    refresh();
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_recipients", filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, false);
  };

  const unread = items.filter((i) => i.read_at === null).length;

  const markOne = async (id: string) => {
    await supabase
      .from("notification_recipients" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    refresh();
  };

  const markAll = async () => {
    if (!user?.id) return;
    await supabase
      .from("notification_recipients" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    refresh();
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative text-muted-foreground hover:text-primary transition-colors"
            title="Notificações"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between p-3 border-b">
            <p className="font-medium text-sm">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <ScrollArea className="max-h-[70vh]">
            {items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Sem notificações
              </p>
            ) : (
              <>
                <ul className="divide-y">
                  {items.map((r) => {
                    const n = r.notification;
                    if (!n) return null;
                    const unreadItem = r.read_at === null;
                    const tipoIcon =
                      n.tipo === "contrato_assinado" ? "✅" :
                      n.tipo === "contrato_aberto" ? "📄" : null;
                    const tipoAccent =
                      n.tipo === "contrato_assinado" ? "border-l-2 border-emerald-500" :
                      n.tipo === "contrato_aberto" ? "border-l-2 border-amber-500" : "";
                    const handleClick = () => {
                      if (unreadItem) markOne(r.id);
                      if (n.lead_id) {
                        setOpen(false);
                        navigate("/pipeline");
                        setTimeout(() => {
                          window.dispatchEvent(
                            new CustomEvent("open-lead-card", { detail: { leadId: n.lead_id } })
                          );
                        }, 50);
                      }
                    };
                    return (
                      <li
                        key={r.id}
                        onClick={handleClick}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-accent/50 transition-colors",
                          unreadItem && "bg-primary/10",
                          tipoAccent
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {unreadItem && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">
                              {tipoIcon && <span className="mr-1">{tipoIcon}</span>}
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {n.created_by_nome ? `${n.created_by_nome} · ` : ""}
                              {timeAgo(n.created_at)}
                              {n.lead_id ? " · clique para abrir o card" : ""}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hasMore && (
                  <div className="p-2 border-t">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full text-xs py-2 rounded hover:bg-accent/50 text-muted-foreground disabled:opacity-50"
                    >
                      {loadingMore ? "Carregando..." : "Carregar mais"}
                    </button>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {isAdmin && <SendNotificationDialog />}
    </div>
  );
}

function SendNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"team" | "user">("team");
  const [userId, setUserId] = useState<string>("");
  const [usuarios, setUsuarios] = useState<Array<{ user_id: string; nome: string; email: string; role: string | null }>>([]);
  const [canais, setCanais] = useState<Array<{ channel_id: string; nome: string }>>([]);
  const [channelId, setChannelId] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: u }, { data: c }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("user_id, nome, email, role")
          .not("user_id", "is", null)
          .order("nome"),
        supabase
          .from("slack_canais" as any)
          .select("channel_id, nome")
          .eq("ativo", true)
          .order("nome"),
      ]);
      setUsuarios((u as any) ?? []);
      setCanais((c as any) ?? []);
    })();
  }, [open]);

  const submit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }
    if (target === "user" && !userId) {
      toast.error("Selecione um vendedor");
      return;
    }
    setSending(true);
    try {
      const body: any = { title: title.trim(), message: message.trim(), target_type: target };
      if (target === "user") body.target_user_id = userId;
      if (target === "team" && channelId) body.slack_channel_id = channelId;
      const { data, error } = await supabase.functions.invoke("enviar-notificacao", { body });
      if (error) throw error;
      const n = (data as any)?.recipients ?? 0;
      toast.success(`Notificação enviada para ${n} pessoa(s)`);
      setTitle("");
      setMessage("");
      setUserId("");
      setChannelId("");
      setTarget("team");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar notificação");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Enviar notificação"
        >
          <Send className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar notificação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título curto" />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Time todo</SelectItem>
                <SelectItem value="user">Um vendedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === "user" && (
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.nome} {u.role ? `· ${u.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {target === "team" && (
            <div className="space-y-1.5">
              <Label>Canal do Slack (opcional)</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger><SelectValue placeholder="Sem canal (só in-app)" /></SelectTrigger>
                <SelectContent>
                  {canais.map((c) => (
                    <SelectItem key={c.channel_id} value={c.channel_id}>
                      #{c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Se deixar vazio, a notificação só aparece no sino dos usuários.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={submit} disabled={sending}>{sending ? "Enviando..." : "Enviar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
