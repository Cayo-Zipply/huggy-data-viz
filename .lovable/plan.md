## Objetivos

1. **Farol fiel ao pipe**: refletir exatamente o que está no Kanban (ex.: 6 marcadas e 5 realizadas no mês devem aparecer iguais no Farol).
2. **Admins editam o painel**: adicionar/editar metas mensais e gerenciar quais SDRs/Closers aparecem no Farol.
3. **Alerta de owner faltante**: reuniões sem closer/SDR responsável aparecem com um ícone de alerta clicável que abre o card para definir o proprietário — mas continuam sendo contabilizadas.

---

## Mudanças por arquivo

### `src/components/FarolPanel.tsx` (refatoração principal)

**Recontagem fiel ao pipe (mês selecionado):**
- Substituir `monthCards` (apenas `created_at` no mês) por uma contagem baseada em **eventos no mês**, igual ao Kanban:
  - **Reuniões marcadas**: cards cuja stage atual é `reuniao_marcada/agendada/realizada/link_enviado/contrato_assinado/no_show` **OU** que têm um `history.to === "reuniao_marcada"` cuja `at` cai no mês selecionado. Conta também marcações que viraram realização/no-show no mesmo mês.
  - **Reuniões realizadas**: stage atual `reuniao_realizada/link_enviado/contrato_assinado` **OU** `history.to ∈ {reuniao_realizada, reuniao_agendada}` no mês. Iguala ao número exibido nas colunas do Kanban.
  - **Vendas/Faturamento**: `lead_status === "ganho"` com `data_venda` (ou `stage_changed_at` quando vazio) dentro do mês.
  - **No Shows**: stage atual `no_show` **OU** `history.to === "no_show"` no mês.
- Atribuição por pessoa: usar `owner` (quando existir). Se não houver owner, agrupar em uma linha "Sem responsável" e **continuar somando** no Total.
- Adicionar uma linha "Sem responsável" no INBOUND e PRÉ-VENDAS quando houver itens nessa categoria, com botão/ícone `AlertTriangle` (`lucide-react`) por contagem que permita clicar — emite `onOpenUnassigned()` para o painel pai abrir um modal listando os cards sem owner; cada item da lista abre o `LeadDrawer` para o usuário atribuir o responsável.
- Ícone de alerta também aparece em qualquer linha de SDR/Closer cuja contagem inclua cards sem owner do tipo correspondente (ex.: card está em `reuniao_marcada` sem closer atribuído).

**Cabeçalho com ações de admin:**
- Receber prop `isAdmin: boolean` e `members: TeamMember[]` (de `useTeamMembers`).
- Quando admin:
  - Botão "Editar Metas" (abre `Dialog` com inputs por SDR/Closer × campos: faturamento_meta, reuniões marcadas/realizadas, conversão).
  - Botão "Gerenciar Time do Farol" (abre `Dialog` listando `useTeamMembers().members`, com toggles para incluir/excluir cada nome em INBOUND/PRÉ-VENDAS via flag `pode_ser_responsavel` + role).
- Para usuários não-admin: somente leitura (sem botões).

**Origem dos owners exibidos:**
- INBOUND (closers): usar `useTeamMembers().closers` (pessoas com role/secondary_role `closer` ou `admin`) em vez de derivar da lista de cards. Isso garante que o admin controle quem aparece no painel.
- PRÉ-VENDAS (SDRs): usar `useTeamMembers().sdrs`.
- Sempre incluir a linha "Sem responsável" se houver cards correspondentes.

### `src/components/pipeline/GoalsPanel.tsx` (reuso parcial)

- Extrair o formulário de edição por pessoa (`CloserGoals`) e reutilizá-lo dentro do novo `Dialog` "Editar Metas" do `FarolPanel`. Passar `monthKey` correspondente ao mês selecionado no Farol (não apenas o mês corrente).
- Sem mudanças funcionais no painel `Metas` da aba Pipeline.

### `src/pages/Index.tsx`

- Passar `isAdmin` (de `useAuth`) e `onSaveGoal={upsertGoal}` ao `<FarolPanel>`.
- Trocar `owners={pipelineOwners}` por uma combinação: `closerNames` + `sdrNames` de `useTeamMembers`, e passar a lista `members` para o painel de gerenciamento.

### `src/components/PipelinePanel.tsx`

- Expor `upsertGoal` para o Index (já é retornado por `usePipelineData`); apenas garantir que `Index` tenha acesso. Como `Index` já chama `usePipelineData`, basta destruturar `upsertGoal` lá.

### Modal "Owner faltante" (novo, dentro de `FarolPanel.tsx` ou pequeno componente irmão)

- Lista cards do mês onde `!owner` e stage ∈ reuniões. Cada item mostra nome do lead, stage atual, data, e abre o `LeadDrawer` ao clicar (via callback que sobe até `Index`/`PipelinePanel` ou via roteamento simples — preferir callback `onOpenCard(cardId)` que navega para `/pipeline` e seta `selectedCardId` em `sessionStorage`).

---

## Detalhes técnicos

- A regra "fiel ao pipe" usa `cardsReachedStage` adaptado para filtrar por `at` no mês:
  ```ts
  const reachedInMonth = (cards, stage, start, end) =>
    cards.filter(c =>
      c.history.some(h => h.to === stage && new Date(h.at) >= start && new Date(h.at) <= end)
      || (c.stage === stage && new Date(c.stage_changed_at) >= start && new Date(c.stage_changed_at) <= end)
    );
  ```
- Persistência das metas continua via `upsertGoal` → tabela `metas` (já existe).
- "Gerenciar Time" altera `user_profiles.pode_ser_responsavel` (campo já existe) — UPDATE permitido apenas para admins (RLS já cobre via `admins_update_any_profile`).
- Sem migrações de DB.
- Sem impacto no Kanban / Dashboard / outras abas.

---

## Critérios de aceite

- Maio/2026 com 6 reuniões marcadas e 5 realizadas no Kanban → Farol mostra 6 e 5.
- Admin vê botões "Editar Metas" e "Gerenciar Time"; outros usuários não.
- Reunião sem closer aparece em "Sem responsável" com ícone ⚠️ que abre o card para atribuição.
- Total nunca ignora cards sem owner.
