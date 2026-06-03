import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  Search,
  Compass,
  GitBranch,
  Repeat,
  Wrench,
  Cog,
  Database,
  Webhook,
  Facebook,
  Plug,
} from "lucide-react";

type Section = {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
  searchText: string;
};

const SECTIONS: Section[] = [
  {
    id: "o-que-e",
    title: "1. O que é o Farol",
    icon: Compass,
    searchText:
      "farol crm pipeline pena quadros pqa lead card sdr closer supabase tintim",
    content: (
      <div className="space-y-2">
        <p>
          O <strong className="text-foreground">Farol</strong> é o CRM/pipeline comercial da{" "}
          <strong className="text-foreground">Pena Quadros Assessoria Tributária (PQA)</strong>. Ele acompanha cada lead
          desde o primeiro contato até o fechamento (ou perda) do contrato.
        </p>
        <p>
          Cada lead é um <strong className="text-foreground">card</strong> que caminha por etapas. A cor/posição do card
          indica em que ponto da jornada o cliente está e se há pendências (SLA).
        </p>
        <p>
          O Farol é dividido em <strong className="text-foreground">dois funis (pipes)</strong>:{" "}
          <strong className="text-foreground">SDR</strong> (pré-venda/qualificação) e{" "}
          <strong className="text-foreground">Closer</strong> (venda). Um mesmo cliente pode aparecer nos dois pipes em
          momentos diferentes.
        </p>
        <p>
          Todo o dado vive no <strong className="text-foreground">Supabase</strong> (banco + automações). O lead entra
          automaticamente pelas campanhas (via Tintim) e também pode ser criado manualmente.
        </p>
      </div>
    ),
  },
  {
    id: "pipes-etapas",
    title: "2. Pipes e etapas",
    icon: GitBranch,
    searchText:
      "pipe etapa sdr closer fez contato conectado sql reuniao marcada realizada contrato assinado perdido no show link enviado tintim",
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-foreground mb-2">Pipe SDR (pré-venda):</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Fez Contato</strong> — lead novo, ainda não respondeu. É o maior volume de entrada do funil.</li>
            <li><strong className="text-foreground">Conectado</strong> — o lead já respondeu pelo menos uma vez.</li>
            <li><strong className="text-foreground">SQL</strong> — lead qualificado (tem perfil e interesse reais para avançar).</li>
            <li><strong className="text-foreground">Reunião Marcada</strong> — reunião agendada com o cliente.</li>
            <li><strong className="text-foreground">Reunião Realizada</strong> — a reunião aconteceu.</li>
            <li><strong className="text-foreground">Contrato Assinado</strong> — virou venda.</li>
            <li><strong className="text-foreground">Perdido</strong> — lead descartado (com motivo de perda).</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">Pipe Closer (venda):</h4>
          <p>
            Reunião Agendada → Link Enviado → Reunião Realizada → Contrato Assinado, com{" "}
            <strong className="text-foreground">No Show</strong> para quando o cliente falta.
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
          <p><strong className="text-foreground">Observações importantes:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>A movimentação entre etapas acontece de duas formas: automática (via Tintim, quando o status muda no WhatsApp) ou manual (arrastando o card no Pipe).</li>
            <li>Toda mudança de etapa é registrada no histórico do lead (quem moveu, de onde para onde, quando).</li>
            <li>Um mesmo telefone pode existir no pipe SDR e no pipe Closer ao mesmo tempo (é permitido). O que não é permitido é duplicar o lead dentro do mesmo pipe.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "ciclo-vida",
    title: "3. Ciclo de vida do lead",
    icon: Repeat,
    searchText: "ciclo vida entrada qualificacao venda ganho perda blacklist tintim slack meta jurídico financeiro",
    content: (
      <div className="space-y-2">
        <p><strong className="text-foreground">Entrada</strong> — o lead chega pela campanha (Tintim → WhatsApp) ou é criado à mão. Na entrada o sistema verifica a blacklist (telefones banidos não voltam) e evita duplicados.</p>
        <p><strong className="text-foreground">Qualificação (SDR)</strong> — o SDR conversa, qualifica e, quando o lead tem perfil, marca a reunião e passa para o Closer. Na passagem SDR→Closer, campos do lead são copiados para o card do Closer.</p>
        <p><strong className="text-foreground">Venda (Closer)</strong> — o Closer conduz a reunião, envia material/link, gera o contrato e fecha.</p>
        <p><strong className="text-foreground">Ganho</strong> — ao marcar "Contrato Assinado/Ganho", dispara o fluxo de pós-venda: notificação no Slack, e-mails internos (jurídico + financeiro) e envio de evento de conversão para a Meta.</p>
        <p><strong className="text-foreground">Perda</strong> — ao marcar como perdido, o lead recebe um motivo de perda (lista configurável) e sai do funil ativo.</p>
      </div>
    ),
  },
  {
    id: "funcionalidades",
    title: "4. Funcionalidades do dia a dia",
    icon: Wrench,
    searchText:
      "anotacoes anexos ipbox click to call meet google read.ai zapsign contrato e-mail juridico financeiro gemini metas materiais dashboards novidades feedback",
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li><strong className="text-foreground">Pipe / cards</strong> — arraste cards entre etapas; clique para abrir os detalhes do lead.</li>
        <li><strong className="text-foreground">Anotações</strong> — registre observações no lead (tabela de anotações por lead).</li>
        <li><strong className="text-foreground">Anexos</strong> — documentos do lead (contratos, transcrição de reunião, etc.). O contrato gerado vira anexo automaticamente.</li>
        <li><strong className="text-foreground">Click-to-call (IPBOX)</strong> — ligue para o lead direto do card. Cada closer precisa ter uma linha cadastrada nos agentes IPBOX; sem isso a ligação não completa.</li>
        <li><strong className="text-foreground">Reuniões (Google Meet)</strong> — agende, atualize ou cancele a reunião pelo card; o link do Meet é criado automaticamente na agenda do responsável.</li>
        <li><strong className="text-foreground">Transcrição da reunião</strong> — capturada automaticamente pelo Read.ai e anexada ao lead. Quando não há transcrição automática, dá para anexar o arquivo .txt manualmente.</li>
        <li><strong className="text-foreground">Contrato (ZapSign)</strong> — gera o contrato em Word a partir do template, manda para assinatura e acompanha o status (assinado). O PDF assinado fica disponível para baixar/visualizar (o link de visualização é gerado fresco a cada clique porque expira em ~1h).</li>
        <li>
          <strong className="text-foreground">E-mail Jurídico / Financeiro pós-ganho</strong> — ao ganhar, o sistema gera dois rascunhos de e-mail interno:
          <ul className="list-[circle] list-inside ml-6 mt-1 space-y-1">
            <li><strong className="text-foreground">Financeiro:</strong> modelo fixo preenchido com os dados do CRM (empresa, sócio, valor, forma de pagamento, etc.).</li>
            <li><strong className="text-foreground">Jurídico:</strong> a IA (Google Gemini) reescreve a transcrição completa da reunião no formato de 4 tópicos (situação fiscal, prioridades, soluções, próximos passos). O botão "Regenerar com IA" refaz o rascunho. Ambos vão com o contrato em anexo e são enviados pelo Gmail do próprio closer.</li>
          </ul>
        </li>
        <li><strong className="text-foreground">Motivos de perda</strong> — lista configurável usada ao perder um lead.</li>
        <li><strong className="text-foreground">Metas</strong> — metas por closer/mês, usadas nos faróis e dashboards.</li>
        <li><strong className="text-foreground">Materiais de apoio</strong> — central com prompt jurídico, matriz de objeção, credenciais, mensagens padrão, headlines, etc.</li>
        <li><strong className="text-foreground">Dashboards e métricas</strong> — conversão por etapa, fechamentos por faixa de valor da dívida, panorama CPF/CNPJ, conversão de fim de semana, métricas por tipo de documento, volumes por mês.</li>
        <li><strong className="text-foreground">Popup de novidades</strong> — avisos de novas funcionalidades aparecem ao atualizar a página.</li>
        <li><strong className="text-foreground">Feedback</strong> — canal interno para reportar problemas/sugestões dentro do app.</li>
      </ul>
    ),
  },
  {
    id: "automacoes",
    title: "5. Automações e regras (lógica de bastidores)",
    icon: Cog,
    searchText: "anti duplicado blacklist contrato anexo sla historico normalizacao",
    content: (
      <ul className="list-disc list-inside space-y-1.5">
        <li><strong className="text-foreground">Anti-duplicado</strong> — ao tentar criar um lead com o mesmo telefone, mesmo pipe e com status aberto, o sistema bloqueia a criação manual (erro) e ignora silenciosamente quando vem de webhook. Duplicar entre pipes diferentes (SDR↔Closer) é permitido.</li>
        <li><strong className="text-foreground">Blacklist</strong> — telefones marcados como banidos não podem ser recriados; mesmo que a campanha (Tintim) tente reinserir, o lead é ignorado. Atualizações em leads que sobreviveram a uma exclusão parcial continuam permitidas.</li>
        <li><strong className="text-foreground">Contrato → anexo</strong> — quando o contrato é gerado, ele é automaticamente registrado como anexo do lead.</li>
        <li><strong className="text-foreground">SLA por etapa</strong> — cada etapa tem um prazo (SLA, em horas) configurável. Estourou o prazo, o card sinaliza pendência. Os prazos e o liga/desliga ficam numa configuração própria.</li>
        <li><strong className="text-foreground">Histórico</strong> — toda transição de etapa é gravada para auditoria e métricas (ex.: data da reunião realizada por mês).</li>
        <li><strong className="text-foreground">Normalização</strong> — nomes de closer e capitalização de campos são normalizados para os faróis/metas não se confundirem (ex.: nome curto vs. nome longo).</li>
      </ul>
    ),
  },
  {
    id: "supabase",
    title: "6. Integração — Supabase (a base de tudo)",
    icon: Database,
    searchText: "supabase postgres rls edge functions buckets tabelas leads",
    content: (
      <div className="space-y-2">
        <p>
          O Dash inteiro roda sobre o <strong className="text-foreground">Supabase</strong> (projeto{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">riyfdcmmabvpcubusujw</code>): banco PostgreSQL,
          autenticação, armazenamento de arquivos (buckets) e as automações (edge functions e triggers).
        </p>
        <p>
          <strong className="text-foreground">Banco</strong> — tabelas principais: leads (o coração do farol), lead_historico
          (transições), lead_anexos, lead_anotacoes, metas, sla_config, motivos_perda, material_apoio,
          email_envios/email_destinatarios, zapsign_contracts, ipbox_chamadas/ipbox_agentes, meta_ads_*,
          leads_blacklist, app_updates, feedback_reports, user_profiles.
        </p>
        <p><strong className="text-foreground">Edge functions</strong> — pequenas funções que executam as integrações e automações (webhooks de entrada, geração de contrato, e-mails, notificações, etc.).</p>
        <p><strong className="text-foreground">Segurança (RLS)</strong> — o acesso aos dados é controlado por permissões por usuário/papel (admin x closer/staff). Cada usuário enxerga e edita só o que tem direito.</p>
        <p><strong className="text-foreground">Tempo real / atualização</strong> — alterações refletem no Dash; alguns avisos (novidades) aparecem ao atualizar a página.</p>
      </div>
    ),
  },
  {
    id: "tintim",
    title: "7. Integração — Tintim (entrada de leads)",
    icon: Webhook,
    searchText: "tintim webhook whatsapp campanhas status sql ganho perdido pipe sdr blacklist meta capi",
    content: (
      <div className="space-y-2">
        <p>O <strong className="text-foreground">Tintim</strong> é a ponte entre as campanhas (anúncios → WhatsApp) e o Farol. Sempre que o status do contato muda no WhatsApp, o Tintim dispara um webhook para o Dash.</p>
        <p>O webhook do Dash recebe o evento, normaliza o status do Tintim para a etapa correspondente do Farol (ex.: "qualificado" → SQL, "ganho/venda" → Contrato Assinado, "perdido" → Perdido) e:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Procura se já existe lead com aquele telefone (com várias regras de comparação de número, com e sem DDI/DDD).</li>
          <li>Se existe, atualiza a etapa, o valor e o status; se não existe (e não está na blacklist), cria um lead novo no pipe SDR.</li>
          <li>Registra a transição no histórico.</li>
          <li>Encaminha o evento para a Meta (conversão offline — ver próxima seção).</li>
        </ul>
        <p>Todo payload recebido do Tintim é guardado em log para auditoria/depuração.</p>
      </div>
    ),
  },
  {
    id: "meta",
    title: "8. Integração — Meta (Facebook/Instagram Ads)",
    icon: Facebook,
    searchText: "meta facebook instagram ads capi conversions api pixel evento conversao hash sha256 marketing custo",
    content: (
      <div className="space-y-3">
        <p>São duas vias, em sentidos opostos:</p>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Conversões para a Meta (CAPI / eventos offline)</h4>
          <p>quando um lead avança de etapa, o Dash envia um evento de conversão para a Meta (via Conversions API, Pixel <code className="text-xs bg-muted px-1 py-0.5 rounded">1406978337385669</code>). O mapeamento etapa → evento Meta é:</p>
          <ul className="list-disc list-inside space-y-1 mt-1 ml-2">
            <li>Conectado/Fez Contato → <strong className="text-foreground">Contact</strong></li>
            <li>SQL → <strong className="text-foreground">Lead</strong></li>
            <li>Reunião Marcada → <strong className="text-foreground">Schedule</strong></li>
            <li>Reunião Realizada → <strong className="text-foreground">ViewContent</strong></li>
            <li>Contrato Assinado → <strong className="text-foreground">Purchase</strong> (com o valor do negócio em BRL)</li>
          </ul>
          <p className="mt-2">O telefone do lead é enviado com hash (SHA-256) para casar com o usuário sem expor o dado. Isso ensina o algoritmo da Meta a buscar mais pessoas parecidas com quem realmente fecha contrato.</p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Métricas de anúncios (vindo da Meta)</h4>
          <p>o Dash sincroniza gasto e desempenho das campanhas para dentro do banco (tabelas de Meta Ads diário/mensal e configuração), alimentando os dashboards de marketing/custo.</p>
        </div>
      </div>
    ),
  },
  {
    id: "outras",
    title: "9. Outras integrações",
    icon: Plug,
    searchText: "zapsign read.ai ipbox google meet gmail agenda gemini ia slack",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li><strong className="text-foreground">ZapSign (assinatura de contrato)</strong> — gera o contrato em Word a partir do template, envia para assinatura eletrônica e recebe de volta (webhook) o status e o PDF assinado, que vira anexo do lead.</li>
        <li><strong className="text-foreground">Read.ai (transcrição de reunião)</strong> — grava e transcreve as reuniões; o Dash recebe a transcrição e o resumo e associa ao lead correspondente (por participante/e-mail). A transcrição completa alimenta o e-mail jurídico via IA.</li>
        <li><strong className="text-foreground">IPBOX (telefonia / click-to-call)</strong> — permite ligar para o lead direto do card e registra as chamadas. Cada closer precisa de uma linha cadastrada nos agentes IPBOX.</li>
        <li><strong className="text-foreground">Google (Meet + Gmail + Agenda)</strong> — cria/edita/cancela reuniões no Google Meet e envia os e-mails jurídico/financeiro pelo Gmail do próprio closer. Usa tokens do Google por usuário; se o token expira, é preciso deslogar/logar para renovar.</li>
        <li><strong className="text-foreground">Google Gemini (IA)</strong> — reescreve a transcrição da reunião no e-mail jurídico (modelo <code className="text-xs bg-muted px-1 py-0.5 rounded">gemini-2.5-flash</code>). Usa a transcrição completa, nunca o resumo.</li>
        <li><strong className="text-foreground">Slack (avisos)</strong> — ao ganhar um lead, o Dash posta um aviso no canal do time (#closer) com o contrato em anexo.</li>
      </ul>
    ),
  },
];

export function HelpPanel() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.searchText.toLowerCase().includes(q),
    );
  }, [search]);

  const defaultOpen = useMemo(() => SECTIONS.map((s) => s.id), []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Central de Ajuda</h2>
        <p className="text-sm text-muted-foreground">
          Documentação completa do Farol — o CRM comercial da Pena Quadros.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nas seções..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
          Nenhuma seção encontrada para "{search}".
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
          {filtered.map((s) => {
            const Icon = s.icon;
            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border border-border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
                  <span className="flex items-center gap-2 text-left">
                    <Icon size={16} className="text-primary shrink-0" />
                    {s.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                  {s.content}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        Dúvidas ou erros? Use o botão de Feedback no app.
      </p>
    </div>
  );
}
