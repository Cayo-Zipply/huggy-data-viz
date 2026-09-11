# Funil por Criativo v2

## Objetivo
Atualizar somente o card **Funil por Criativo** para consultar as duas RPCs existentes, permitir recortes compartilháveis por URL e manter o funil consistente com os dados calculados no banco.

## Implementação
1. **Dados e estado**
   - Trocar a consulta antiga por `fn_funil_criativo_v2` e carregar opções com `fn_funil_criativo_filtros`.
   - Usar React Query com chaves contendo período, filtros e agrupamento; aplicar debounce de 300 ms aos filtros.
   - Carregar opções apenas quando o período mudar e preservar os controles durante carregamento/erro.
   - Ler e gravar `desde`, `ate`, `camp`, `conj`, `cri` e `agrupar` na URL; validar datas e limitar o início a 01/04/2026.

2. **Controles**
   - Criar seletor de período com atalhos, lista mensal e calendário de intervalo existente.
   - Criar multi-select reutilizável, pesquisável e com contagens, seleção total, limpeza, truncamento e tooltip.
   - Aplicar cascata Campanha → Conjunto → Criativo e remover seleções inválidas ao trocar período ou filtros superiores.
   - Adicionar controle segmentado Criativo | Conjunto | Campanha.

3. **Tabela e funil**
   - Ampliar a tabela com todas as métricas solicitadas e custos apenas no agrupamento Campanha.
   - Manter ordenação por cabeçalhos, linha sem atribuição sempre no fim, scroll interno e total fixo no rodapé.
   - Permitir foco de linha e limpeza do foco; somar apenas as linhas retornadas para o total.
   - Preservar o visual atual do funil, incluindo percentuais e gargalo, e acrescentar custos no modo Campanha.

4. **Avisos e estados**
   - Calcular cobertura exclusivamente a partir da RPC de filtros.
   - Mostrar alertas de atribuição incompleta, coorte recente e indisponibilidade de gasto por criativo/conjunto.
   - Adicionar skeletons, estado vazio com limpeza de filtros e erro com nova tentativa.
   - Garantir empilhamento dos controles, tabela horizontal e funil abaixo em telas estreitas.

## Validação
- Conferir compilação e erros de execução.
- Testar filtros, cascata, foco, agrupamentos, período mínimo e restauração por URL.
- Conferir os números de agosto/2026 informados e o aviso de período recente no mês atual.
- Validar visualmente em desktop e largura próxima de 400 px.

## Limites
- Nenhuma alteração no banco, schema ou funções existentes.
- Nenhuma dependência nova.
- Nenhuma mudança fora do card Funil por Criativo.
