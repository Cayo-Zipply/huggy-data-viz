

## Problema

A lista de closers disponíveis para atribuir como "dono do negócio" é **hardcoded** no código (`CLOSERS = ["Cayo", "Stephanie", "Fillipe"]`). O Café e qualquer novo usuário não aparecem como opção.

Isso afeta 4 lugares:
1. **PipelinePanel** — dropdown de owner ao criar/editar lead
2. **PipelineCard** — dropdown de owner inline
3. **LeadDrawer** — dropdown de owner
4. **PipelineFilters** — botões de filtro por closer

## Solução

Buscar dinamicamente os usuários com role `closer` (primária ou secundária) da tabela `user_profiles`, e incluir também SDRs para cobertura total.

### Mudanças

1. **Criar hook `useTeamMembers`** (`src/hooks/useTeamMembers.ts`)
   - Query na tabela `user_profiles` buscando todos com `role` ou `secondary_role` in (`closer`, `sdr`, `admin`)
   - Retorna lista de nomes, filtrável por role
   - Exporta helpers: `getClosers()`, `getSdrs()`, `getAllMembers()`

2. **PipelinePanel.tsx**
   - Substituir `CLOSERS` no `ownerOptions` pelo resultado do hook
   - O pool de owners passa a ser: membros do hook + owner atual do card + nomes de tasks/goals

3. **PipelineCard.tsx** e **LeadDrawer.tsx**
   - Receber `ownerOptions` como prop (já calculado no PipelinePanel) em vez de montar localmente com `CLOSERS`

4. **PipelineFilters.tsx**
   - Receber lista de closers como prop em vez de usar `CLOSERS` hardcoded
   - Os botões de filtro mostram todos os membros da equipe

5. **types.ts**
   - Manter `CLOSERS` como fallback mas marcar como deprecated

### Dados atuais no banco
| Nome | Role | Secondary |
|------|------|-----------|
| Café | sdr | closer |
| Cayo Bitencourt | admin | — |
| Fillipe Amorim Oliveira Silva | closer | — |
| Stephanie | closer | — |

Com essa mudança, o Café aparecerá automaticamente como opção de closer/owner em todos os dropdowns.

