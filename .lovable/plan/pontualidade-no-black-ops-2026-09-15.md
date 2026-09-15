# Pontualidade no Black Ops

## Objetivo
Adicionar a aba interna **Pontualidade** ao Black Ops, usando exclusivamente as tabelas e views já existentes.

## Implementação
- Criar uma tela dedicada de Pontualidade e conectá-la às abas atuais do Black Ops.
- Montar o painel de calibração lendo a linha `id = 1` de `se_pontualidade_config`, com switch, campos numéricos, textos de ajuda e salvamento por `update`.
- Após salvar a calibração, atualizar os dados de pontualidade, reuniões e ranking e mostrar confirmação.
- Carregar a fila pela view `vw_se_pontualidade_revisar`, com filtros de closer, veredicto, mês e somente não conferidos.
- Exibir resumo com pendências, atrasos confirmados, maior atraso e pontos perdidos.
- Gerar o mini-ranking por closer a partir de `vw_se_reunioes` e do mês selecionado.
- Construir tabela responsiva com badges, indicador de conferência, formatação em Brasília e atraso negativo como “adiantado”.
- Permitir expandir cada linha para comparar agendamento e primeiras falas em uma linha do tempo.
- Implementar os quatro veredictos manuais em modal, incluindo observação e atraso manual quando aplicável.
- Implementar “Limpar ajuste” apagando apenas o ajuste da reunião.
- Após qualquer ajuste, atualizar fila, reuniões e ranking.

## Detalhes técnicos
- Reutilizar o cliente de dados, autenticação, React Query e componentes visuais já usados no projeto.
- Usar `upsert` com conflito em `readai_meeting_id` e o e-mail do usuário autenticado.
- Não criar ou alterar tabelas, views, funções, migrations, políticas ou edge functions.
- Manter as alterações concentradas na nova tela e na inclusão da aba em Black Ops.

## Validação
- Verificar compilação e erros de execução.
- Validar carregamento, filtros, expansão, salvamento, limpeza e atualização dos totais.
- Conferir o layout em desktop e largura móvel.
