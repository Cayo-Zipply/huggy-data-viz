## Mudanças solicitadas

### 1. Excluir card (todos os usuários)
- Adicionar botão "Excluir card" no `PipelineCardItem` (aba Ações) e também no `LeadDrawer` (rodapé), disponível para qualquer usuário autenticado.
- Confirmação via `AlertDialog` antes da exclusão para evitar exclusão acidental.
- Exclusão em cascata: remover o lead em `pipeline_cards` (já tem RLS público para DELETE) + tasks relacionadas em `pipeline_tasks` + histórico em `lead_history` + labels em `pipeline_card_labels`.
- Registrar a exclusão em log (opcional, em `lead_history` antes do delete cascata) com nome do usuário que excluiu.
- Atualizar estado local no `usePipelineData` removendo o card sem precisar de refetch.

### 2. Contrato "Em assinatura" → mover automaticamente para "Link enviado"
- Hoje, ao marcar contrato como `enviado` (em assinatura via ZapSign/WhatsApp), o card permanece na etapa atual.
- Ajustar `ContractTab.tsx` (e qualquer fluxo que seta `contrato_status = "enviado"`) para também mover o card para o estágio `link_enviado` no pipe do Closer via `moveCard`.
- Mesma lógica para o callback de webhook do ZapSign caso exista (verificar `generate-contract-docx`).
- Registrar no histórico (`lead_historico`) a transição automática com motivo "Contrato enviado para assinatura".

### 3. Indicador de lead duplicado
- Critério: telefone (últimos 8 dígitos), e-mail (lowercase) ou CNPJ — qualquer um que coincida com outro card existente conta como duplicado. Nome NÃO é critério.
- Implementar um hook utilitário `useDuplicateLeads(cards)` que retorna, para cada card, o array de IDs duplicados encontrados.
- No `PipelineCardItem`:
  - Mostrar badge discreta "Duplicado" (vermelho/âmbar) ao lado das outras badges.
  - Tooltip ao passar o mouse listando os leads duplicados (nome + dono + etapa) com link para abrir.
- No `LeadDrawer`: seção "Possíveis duplicados" exibindo a lista completa com botão para abrir cada um.

## Detalhes técnicos

- **Arquivos a editar:**
  - `src/components/pipeline/PipelineCardItem.tsx` (botão excluir + badge duplicado)
  - `src/components/pipeline/LeadDrawer.tsx` (botão excluir + seção duplicados)
  - `src/components/pipeline/ContractTab.tsx` (mover para link_enviado ao enviar)
  - `src/components/pipeline/usePipelineData.ts` (função `deleteCard`, expor para componentes)
  - `src/hooks/useDuplicateLeads.ts` (novo)
  - `src/components/pipeline/StageColumn.tsx` / `PipelinePanel.tsx` (encaminhar prop `onDelete` e duplicados)

- **Banco:** nenhuma migração necessária. RLS já permite DELETE público em `pipeline_cards`. Tasks/histórico também têm acesso público.

- **Normalização para duplicados:**
  - Telefone: `telefone.replace(/\D/g,"").slice(-8)`
  - E-mail: `email.trim().toLowerCase()`
  - CNPJ: `cnpj.replace(/\D/g,"")`
  - Ignorar valores vazios/nulos ao comparar.

- **Mover ao enviar contrato:** reaproveitar `moveCard(cardId, "link_enviado")` já existente em `usePipelineData`, garantindo que só dispare quando o status muda de outro estado para `enviado` (evitar loop).
