const TZ = "America/Sao_Paulo";

function partsSP(iso: string) {
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(d).toLowerCase();
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { weekday, date, time };
}

export function buildReuniaoMessage(params: {
  cliente: string;
  empresa?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  link: string;
}): string {
  const { cliente, empresa, data_inicio, data_fim, link } = params;
  const ini = partsSP(data_inicio);
  const horario = data_fim ? `${ini.time} às ${partsSP(data_fim).time}` : `às ${ini.time}`;
  const primeiroNome = (cliente || "").trim().split(/\s+/)[0] || cliente;
  const dataExtenso = `${ini.weekday}, ${ini.date}`;

  const linhas = [
    "📌 *Reunião confirmada — Pena Quadros Advocacia*",
    "",
    `${primeiroNome}, está tudo certo! Sua reunião está agendada:`,
    "",
  ];
  if (empresa && empresa.trim()) linhas.push(`🏢 *Empresa:* ${empresa}`);
  linhas.push(`🗓️ *Data:* ${dataExtenso}`);
  linhas.push(`🕐 *Horário:* ${horario}`);
  linhas.push(`💻 *Link da reunião:* ${link}`);
  linhas.push("");
  linhas.push("Qualquer dúvida, estou à disposição. Até lá!");
  return linhas.join("\n");
}
