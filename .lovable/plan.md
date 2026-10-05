# Restringir responsáveis visíveis no Pipe

## Objetivo
Exibir nos seletores de closer/responsável do Pipe somente usuários marcados como visíveis, mantendo “Sem dono” e preservando a leitura de responsáveis antigos.

## Alterações
- Consultar `user_profiles` com `visivel_dropdown_closer = true`, ordenando por `nome`.
- Usar exclusivamente esses nomes nas opções de atribuição dos cards SDR/Closer e na criação de lead.
- Manter “Sem dono” no topo.
- Quando o responsável atual não estiver na lista, mostrá-lo apenas naquele lead como `Nome (inativo)`, sem oferecê-lo aos demais.
- Separar essas opções das listas usadas em filtros, dashboards, metas, rankings e histórico, que continuarão incluindo nomes antigos.

## Validação
- Conferir que os seletores de atribuição recebem apenas os perfis visíveis.
- Conferir que um responsável legado permanece selecionado como inativo.
- Validar a compilação e o fluxo disponível no preview.
