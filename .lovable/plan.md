## Problema
O diálogo "Motivo da Perda" em `src/components/PipelinePanel.tsx` (linhas 819–847) usa uma lista hardcoded com apenas as 5 categorias (`Preço, Timing, Qualificação, Concorrência, Outros`), ignorando os motivos configurados em Settings → Motivos de Perda (tabela `motivos_perda`, já carregados via `useMotivosPerda` no mesmo arquivo).

## Correção (cirúrgica, só UI)
Em `src/components/PipelinePanel.tsx`:

1. Substituir o `<option>` hardcoded por um loop sobre `activeMotivos`, agrupando por categoria (`<optgroup label={categoria}>`) para manter contexto visual. Adicionar uma opção final `"Outro"` que mantém o comportamento atual de exibir o textarea livre.

2. Ajustar `confirmLoss` (linhas 455–466) para:
   - tratar `motivo === "Outro"` (singular) como a flag de motivo livre (em vez de `"Outros"`);
   - quando for um motivo do catálogo, salvar `loss_reason = nome do motivo` e `loss_category = categoria do motivo` (lookup em `activeMotivos`), preservando o enum atual (`preco | timing | concorrente | sem_budget | sem_resposta | outro`). Mapear a string da categoria para o enum; categorias customizadas caem em `outro`.

3. Ajustar a condição de habilitar o botão e o `onChange` para usar `"Outro"`.

Nenhuma mudança em schema, hooks ou no `LeadDrawer`/`PipelineCard` (eles só leem `loss_reason`/`loss_category`).