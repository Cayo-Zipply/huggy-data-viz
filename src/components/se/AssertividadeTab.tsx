import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/PersonAvatar";

export type AssertividadeRow = {
  closer: string | null;
  mes: string | null;
  reunioes: number | null;
  com_link: number | null;
  pct_envia_link: number | null;
  assinados: number | null;
  conv_link_contrato: number | null;
  conv_reuniao_contrato: number | null;
  assinados_48h: number | null;
  pct_assina_48h: number | null;
  dias_mediano_assinatura: number | null;
  links_na_janela: number | null;
  links_mortos: number | null;
  valor_links_mortos: number | null;
  nota_media_assinou: number | null;
  nota_media_nao_assinou: number | null;
  meta_conversao: number | null;
  pct_da_meta_conversao: number | null;
};

export type NotaXConversaoRow = {
  mes: string | null;
  faixa_nota: string | null;
  links_enviados: number | null;
  assinados: number | null;
  conversao: number | null;
};

export type ReuniaoDesfechoRow = {
  lead_id: string | null;
  reuniao_id: string | null;
  empresa: string | null;
  closer: string | null;
  mes: string | null;
  data_reuniao: string | null;
  etapa_atual: string | null;
  lead_status: string | null;
  valor: number | null;
  nota: number | null;
  nota_tecnica: number | null;
  link_enviado_em: string | null;
  assinado_em: string | null;
  horas_reuniao_ate_link: number | null;
  dias_link_ate_assinatura: number | null;
  assinou: boolean | null;
  assinou_em_48h: boolean | null;
  desfecho: string | null;
};

export const DESFECHO_META: Record<string, { label: string; cls: string }> = {
  assinou: {
    label: "assinou",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  "link na janela": {
    label: "link na janela",
    cls: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  },
  "link morto": {
    label: "link morto",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
  },
  "sem link": {
    label: "sem link",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export function DesfechoChip({ desfecho }: { desfecho: string | null }) {
  if (!desfecho) return <span className="text-muted-foreground">—</span>;
  const meta = DESFECHO_META[desfecho] ?? DESFECHO_META["sem link"];
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
}

export function fmtDiasAssinatura(d: number | null | undefined) {
  if (d === null || d === undefined) return "—";
  if (d < 1) return "mesmo dia";
  const n = Math.round(d);
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

const brl0 = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Number(v)}%`;

function metaSelo(p: number | null | undefined) {
  if (p === null || p === undefined) return "text-muted-foreground";
  if (p >= 100) return "text-emerald-500";
  if (p >= 80) return "text-amber-500";
  return "text-red-500";
}

function Card({
  label,
  value,
  valueClass,
  sub,
  subClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: React.ReactNode;
  subClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-semibold text-foreground", valueClass)}>
        {value}
      </p>
      {sub ? (
        <p className={cn("text-[11px] text-muted-foreground mt-1", subClass)}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Soma/pondera as linhas por closer para exibir o topo do bloco. */
function agregar(rows: AssertividadeRow[]): AssertividadeRow | null {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const s = (f: (r: AssertividadeRow) => number | null | undefined) =>
    rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);
  const reunioes = s((r) => r.reunioes);
  const comLink = s((r) => r.com_link);
  const assinados = s((r) => r.assinados);
  const assinados48 = s((r) => r.assinados_48h);
  const metas = rows
    .map((r) => r.meta_conversao)
    .filter((v): v is number => typeof v === "number");
  const metaConv = metas.length
    ? metas.reduce((a, b) => a + b, 0) / metas.length
    : null;
  const convReuniao = reunioes > 0 ? (assinados / reunioes) * 100 : 0;
  const medianas = rows
    .map((r) => r.dias_mediano_assinatura)
    .filter((v): v is number => typeof v === "number");
  const notasSim = rows
    .map((r) => r.nota_media_assinou)
    .filter((v): v is number => typeof v === "number");
  const notasNao = rows
    .map((r) => r.nota_media_nao_assinou)
    .filter((v): v is number => typeof v === "number");
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    closer: null,
    mes: rows[0].mes,
    reunioes,
    com_link: comLink,
    pct_envia_link: reunioes > 0 ? (comLink / reunioes) * 100 : 0,
    assinados,
    conv_link_contrato: comLink > 0 ? (assinados / comLink) * 100 : 0,
    conv_reuniao_contrato: convReuniao,
    assinados_48h: assinados48,
    pct_assina_48h: assinados > 0 ? (assinados48 / assinados) * 100 : 0,
    dias_mediano_assinatura: avg(medianas),
    links_na_janela: s((r) => r.links_na_janela),
    links_mortos: s((r) => r.links_mortos),
    valor_links_mortos: s((r) => r.valor_links_mortos),
    nota_media_assinou: avg(notasSim),
    nota_media_nao_assinou: avg(notasNao),
    meta_conversao: metaConv,
    pct_da_meta_conversao:
      metaConv && metaConv > 0 ? (convReuniao / metaConv) * 100 : null,
  };
}

const round1 = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Math.round(Number(v) * 10) / 10}%`;

export function AssertividadeTab({
  rows,
  notaConversao,
  loading,
}: {
  rows: AssertividadeRow[];
  notaConversao: NotaXConversaoRow[];
  loading: boolean;
}) {
  const [closer, setCloser] = useState("all");

  const closers = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.closer).filter((c): c is string => !!c))
      ).sort(),
    [rows]
  );

  const filtradas = useMemo(
    () => (closer === "all" ? rows : rows.filter((r) => r.closer === closer)),
    [rows, closer]
  );

  const topo = useMemo(() => agregar(filtradas), [filtradas]);

  const tabela = useMemo(
    () =>
      [...filtradas].sort(
        (a, b) =>
          Number(b.conv_reuniao_contrato ?? 0) -
          Number(a.conv_reuniao_contrato ?? 0)
      ),
    [filtradas]
  );

  const chartData = useMemo(
    () =>
      notaConversao
        .filter((n) => n.mes === "TODOS")
        .sort((a, b) => (a.faixa_nota ?? "").localeCompare(b.faixa_nota ?? ""))
        .map((n) => ({
          faixa: (n.faixa_nota ?? "").replace(/^\d+\.\s*/, ""),
          conversao: Number(n.conversao ?? 0),
          rotulo: `${n.assinados ?? 0}/${n.links_enviados ?? 0}`,
        })),
    [notaConversao]
  );

  if (loading)
    return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!rows.length)
    return (
      <p className="text-sm text-muted-foreground">
        Sem reunião realizada no período.
      </p>
    );

  const diffNota =
    topo?.nota_media_assinou != null && topo?.nota_media_nao_assinou != null
      ? Number(topo.nota_media_assinou) - Number(topo.nota_media_nao_assinou)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={closer} onValueChange={setCloser}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os closers</SelectItem>
            {closers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!topo ? (
        <p className="text-sm text-muted-foreground">
          Sem reunião realizada no período.
        </p>
      ) : (
        <>
          {/* A. Cartões */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-card border-2 border-primary/40 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Reunião → contrato
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {round1(topo.conv_reuniao_contrato)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                meta {round1(topo.meta_conversao)} ·{" "}
                <span
                  className={cn(
                    "font-semibold",
                    metaSelo(topo.pct_da_meta_conversao)
                  )}
                >
                  {round1(topo.pct_da_meta_conversao)} da meta
                </span>
              </p>
            </div>
            <Card
              label="Recebem contrato"
              value={round1(topo.pct_envia_link)}
              valueClass={
                Number(topo.pct_envia_link ?? 0) < 70 ? "text-amber-500" : ""
              }
              sub={`${topo.com_link ?? 0} de ${topo.reunioes ?? 0} reuniões`}
            />
            <Card
              label="Link → assinatura"
              value={round1(topo.conv_link_contrato)}
              sub="assinatura alta com envio baixo é seletividade, não desempenho"
            />
            <Card
              label="Assina em 48h"
              value={round1(topo.pct_assina_48h)}
              sub={
                topo.dias_mediano_assinatura == null
                  ? "—"
                  : `mediana ${fmtDiasAssinatura(topo.dias_mediano_assinatura)}`
              }
            />
            <Card
              label="Links mortos"
              value={String(topo.links_mortos ?? 0)}
              sub={`${brl0(topo.valor_links_mortos)} · sem assinatura há mais de 14 dias`}
            />
          </div>

          {/* E. Nota por desfecho */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">
              Nota média por desfecho
            </p>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-[11px] text-muted-foreground">Assinou</p>
                <p className="text-xl font-semibold text-emerald-500">
                  {topo.nota_media_assinou == null
                    ? "—"
                    : Number(topo.nota_media_assinou).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Não assinou</p>
                <p className="text-xl font-semibold text-muted-foreground">
                  {topo.nota_media_nao_assinou == null
                    ? "—"
                    : Number(topo.nota_media_nao_assinou).toFixed(1)}
                </p>
              </div>
              {diffNota != null && (
                <div>
                  <p className="text-[11px] text-muted-foreground">Diferença</p>
                  <p className="text-xl font-semibold text-foreground">
                    {diffNota >= 0 ? "+" : ""}
                    {diffNota.toFixed(1)} pts
                  </p>
                </div>
              )}
            </div>
            {diffNota != null && diffNota >= 5 && (
              <p className="text-xs text-emerald-500 mt-2">
                as calls que fecham são mensuravelmente melhores — a rubrica está
                prevendo resultado
              </p>
            )}
          </div>
        </>
      )}

      {/* B. Tabela por closer */}
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Closer</th>
              <th className="text-left px-3 py-2 font-medium">Reuniões</th>
              <th className="text-left px-3 py-2 font-medium">Recebem link</th>
              <th className="text-left px-3 py-2 font-medium">Link→contrato</th>
              <th className="text-left px-3 py-2 font-medium bg-muted/40">
                Reunião→contrato
              </th>
              <th className="text-left px-3 py-2 font-medium">vs meta</th>
              <th className="text-left px-3 py-2 font-medium">Assina em 48h</th>
              <th className="text-left px-3 py-2 font-medium">Links mortos</th>
              <th className="text-left px-3 py-2 font-medium">Valor parado</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((r) => (
              <tr
                key={`${r.closer}-${r.mes}`}
                className="border-b border-border/50"
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <PersonAvatar name={r.closer} className="h-6 w-6" />
                    <span className="text-foreground">{r.closer ?? "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2">{r.reunioes ?? 0}</td>
                <td className="px-3 py-2">{pct(r.pct_envia_link)}</td>
                <td className="px-3 py-2">{pct(r.conv_link_contrato)}</td>
                <td className="px-3 py-2 font-semibold bg-muted/20">
                  {pct(r.conv_reuniao_contrato)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-medium",
                    metaSelo(r.pct_da_meta_conversao)
                  )}
                >
                  {pct(r.pct_da_meta_conversao)}
                </td>
                <td className="px-3 py-2">{pct(r.pct_assina_48h)}</td>
                <td className="px-3 py-2">{r.links_mortos ?? 0}</td>
                <td className="px-3 py-2">{brl0(r.valor_links_mortos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C. Gráfico nota x conversão */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground">
          A nota prevê a assinatura
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          conversão do contrato enviado, por nota da reunião
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, "conversão"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="conversao" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="rotulo"
                    position="top"
                    style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
