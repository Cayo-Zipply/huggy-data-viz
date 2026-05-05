## Ajustes no Farol de Metas

### 1. Remover coluna "R. Marcadas" do diálogo "Editar Metas"
Em `src/components/FarolPanel.tsx`, no `EditGoalsDialog`:
- Remover o `<th>R. Marcadas</th>` do cabeçalho.
- Remover o `<td>` correspondente (input de `reunioes_marcadas_meta`) de cada linha.
- Manter o campo no objeto `PipelineGoal` salvo (apenas não editável pela UI), preservando valores existentes no banco.

### 2. Corrigir meta de "Reuniões Realizadas" no hero card (6/120 e não 6/60)

**Problema atual:** O card pega `globais.reunioes.meta` de `preVendasTotal.metaRR`, que soma `reunioes_realizadas_meta` dos **SDRs**. Como as metas de R. Realizadas (20, 40, 60) foram cadastradas nos **closers** (Cayo, Café, Fillipe), o total exibido fica zerado/incorreto — caindo para o valor de um único closer (60) em vez da soma 120.

**Correção:** No `useMemo` `globais` (≈ linha 388–451), calcular `metaRRTotal` como a soma de `reunioes_realizadas_meta` de **todos os closers** (`closerRows`) para o `monthKey` atual:

```ts
const metaRRTotal = closerRows.reduce((s, c) => {
  const g = goals.find(x => x.closer === c && x.month === monthKey);
  return s + (g?.reunioes_realizadas_meta || 0);
}, 0);
```

Substituindo a leitura atual `preVendasTotal.metaRR`. Assim, com Cayo=20 + Café=40 + Fillipe=60, o card exibirá **6 / 120**, refletindo o total da equipe de closers.

O restante do cálculo (pace diário, projeção, gap) já usa `metaRRTotal` e ficará automaticamente correto.

### Resultado esperado
- Diálogo "Editar Metas" não mostra mais coluna "R. Marcadas".
- Hero card "Reuniões Realizadas" mostra `6 / 120` (soma das metas dos 3 closers) em vez de `6 / 60`.
