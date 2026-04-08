

## Plano de Implementacao - 3 Features

### 1. Tag "FS" automatica para leads de final de semana

**O que faz:** Todo lead criado no sabado ou domingo recebe automaticamente a etiqueta "FS" (Final de Semana). Essa tag acompanha o lead em todas as etapas para analise posterior de conversao por tag.

**Implementacao:**
- Na funcao `createCard` em `usePipelineData.ts`, apos criar o lead, verificar se `new Date().getDay()` e 0 (domingo) ou 6 (sabado)
- Se sim, buscar (ou criar) a label "FS" na tabela `pipeline_labels` e inserir a associacao em `pipeline_card_labels`
- A label "FS" sera pre-criada via seed/migration ou criada on-demand no primeiro uso
- No `CRMDashboard`, adicionar um grafico/metricas de conversao por tag: agrupar leads por labels e comparar taxa de conversao (ganhos/total) entre leads com tag "FS" vs sem tag

### 2. Aba "Contratos" (admin only)

**O que faz:** Nova aba no menu lateral visivel apenas para admins. Mostra uma tabela com todos os leads com status "ganho" ou `contrato_assinado`, listando: Empresa, CNPJ, Telefone, Email, Valor Mensalidade, % Exito, Estado (UF).

**Implementacao:**
- Adicionar item no `AppSidebar` com rota `/contratos` (roles: `["admin"]`)
- Criar pagina `src/pages/Contratos.tsx` com:
  - Tabela estilizada usando componentes `Table` existentes
  - Filtros: data de criacao (range), data de fechamento (baseada em `zapsign_signed_at` ou `contrato_preparado_em`), e vendedor (owner/closer)
  - Dados vem dos `pipeline_cards` filtrados por `lead_status === "ganho"` ou `stage === "contrato_assinado"`
- Rota protegida com `RoleGuard roles={["admin"]}` em `App.tsx`

### 3. Aba "Farol" - Painel de acompanhamento mensal de metas

**O que faz:** Replica a planilha Google Sheets que voce compartilhou, mostrando o ritmo de metas do mes atual dividido em duas secoes: **Inbound** (closers) e **Pre-Vendas** (SDR). Atualiza automaticamente com base nos dados do pipeline.

**Estrutura do Farol (baseada na planilha):**

```text
INBOUND (Closers)
┌──────────┬───────┬──────────┬──────────┬──────────┬───────┬──────────┬──────────┬──────┬──────┬─────────────┐
│ Closer   │ Vendas│ Realizado│ Meta     │ Projecao │ Falta │ Diferenca│ Proj.Fat │ %Meta│ Conv%│ Ticket Medio│
├──────────┼───────┼──────────┼──────────┼──────────┼───────┼──────────┼──────────┼──────┼──────┼─────────────┤
│ Stephanie│   5   │ R$ 9.125 │ R$35.150 │ R$ 6.390 │   3   │-R$ 2.734 │R$ 50.191 │ 143% │ 26%  │  R$ 1.825   │
│ Filipe   │   3   │ R$ 5.621 │ R$29.750 │ R$ 5.409 │   3   │  -R$ 211 │R$ 30.915 │ 104% │ 19%  │  R$ 1.873   │
│ Total    │   8   │R$ 14.746 │ R$75.400 │R$ 13.709 │   8   │-R$ 1.037 │R$ 81.106 │ 108% │ 20%  │  R$ 1.843   │
└──────────┴───────┴──────────┴──────────┴──────────┴───────┴──────────┴──────────┴──────┴──────┴─────────────┘

PRE-VENDAS (SDR)
┌──────┬──────────┬───────────┬──────┬──────────┬───────┬──────────┬──────┬──────┬───────────┐
│ SDR  │ Reunioes │ Realizadas│ Meta │ Projecao │ Falta │ Projetado│ %Meta│ Conv%│ No Shows  │
│ Total│    35    │    24     │  142 │    26    │  -2   │   132    │  93% │  17% │    15     │
│ Cayo │     0    │     0     │   28 │     5    │  -5   │     0    │   0% │   0% │     5     │
└──────┴──────────┴───────────┴──────┴──────────┴───────┴──────────┴──────┴──────┴───────────┘

+ Taxa de Show: 68,57%
+ Taxa de Conversao por vendedor
```

**Implementacao:**
- Adicionar item no `AppSidebar`: `/farol` (roles: `["admin"]`)
- Criar `src/components/FarolPanel.tsx`:
  - Recebe os `cards` do pipeline e calcula tudo automaticamente:
    - **Vendas**: cards com `lead_status === "ganho"` no mes atual, por closer
    - **Realizado**: soma de `deal_value` dos ganhos
    - **Meta**: vem da tabela `pipeline_goals` (ja existente)
    - **Projecao**: `(realizado / dias_uteis_passados) * dias_uteis_totais`
    - **Ticket Medio**: `realizado / vendas`
    - **Conv%**: `vendas / reunioes_realizadas`
    - **Taxa de Show**: `reunioes_realizadas / reunioes_marcadas`
    - **No Shows**: cards que passaram por `no_show`
  - Secao Inbound: agrupa por closer (Stephanie, Filipe, etc.)
  - Secao Pre-Vendas: agrupa por SDR, conta reunioes marcadas vs realizadas
  - Secao Farming (se houver dados)
  - Seletor de mes para ver meses anteriores
  - Indicadores visuais tipo semaforo (verde/amarelo/vermelho) baseado na projecao vs meta
- Rota em `App.tsx` com `RoleGuard roles={["admin"]}`
- Os dados se atualizam automaticamente conforme leads se movem no pipe

### Detalhes tecnicos

**Arquivos a criar:**
- `src/pages/Contratos.tsx` - pagina de contratos
- `src/components/FarolPanel.tsx` - painel farol

**Arquivos a editar:**
- `src/components/AppSidebar.tsx` - adicionar rotas Contratos e Farol
- `src/App.tsx` - adicionar rotas
- `src/components/pipeline/usePipelineData.ts` - logica auto-tag FS no createCard
- `src/components/pipeline/CRMDashboard.tsx` - adicionar metricas de conversao por tag
- `src/pages/Index.tsx` - adicionar renderizacao do FarolPanel
- `src/hooks/useLabels.ts` - expor funcao para buscar/criar label por nome

