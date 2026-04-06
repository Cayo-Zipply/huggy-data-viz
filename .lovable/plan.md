
Objetivo

Corrigir o login com Google para que o app não fique preso em loading e não volte para `/login` antes de processar o callback.

Diagnóstico

Do I know what the issue is? Sim.

Hoje o problema não é só “o callback do Google”: o fluxo inteiro de auth está inconsistente.

1. `src/contexts/AuthContext.tsx` está na ordem errada:
   - chama `getSession()` antes de registrar `onAuthStateChange`
   - isso pode perder o evento que troca o `code` da URL pela sessão

2. O contrato do contexto está quebrado:
   - o contexto expõe `signIn`
   - `src/pages/Login.tsx` usa `signInWithGoogle`
   - `src/hooks/useLeads.ts` e `src/pages/Pipeline.tsx` usam `isCloser`/`isAdmin`, mas esses campos não existem no contexto atual

3. O app está misturando dois clientes do backend:
   - `src/lib/supabase.ts` usa o cliente gerado do projeto atual
   - `src/lib/supabaseExternal.ts` usa outro backend para leads/pipeline
   - isso pode autenticar em um lugar e buscar perfil/dados em outro

4. O projeto nem está estável para validar auth:
   - `src/components/AppSidebar.tsx` está quebrado em JSX
   - `supabase/functions/webhook-zapier/index.ts` tem erro TS com `error` do tipo `unknown`

Plano de correção

1. Estabilizar o build primeiro
   - Corrigir `src/components/AppSidebar.tsx` para voltar a compilar
   - Corrigir `supabase/functions/webhook-zapier/index.ts` usando narrowing seguro:
     - `error instanceof Error ? error.message : "Erro desconhecido"`

2. Unificar o cliente de autenticação/dados
   - Padronizar `src/lib/supabase.ts` como único cliente usado pelo app
   - Parar de misturar `supabaseExt` com `sbExt`
   - Atualizar os consumidores para usar o mesmo cliente em auth, `user_profiles`, leads e realtime
   - Isso elimina o cenário “login feito, mas perfil não encontrado no mesmo backend”

3. Reescrever a inicialização do `AuthContext`
   - Criar uma função central, por exemplo `applySession(session)`, para:
     - setar `user`
     - setar `session`
     - buscar perfil
     - limpar estado quando não houver sessão
   - Registrar `onAuthStateChange` antes de qualquer leitura de sessão
   - Só depois chamar `auth.getSession()`
   - Manter `loading = true` até a primeira resolução completa
   - Garantir que qualquer caminho finalize com `setLoading(false)`
   - Evitar race condition com `mounted`/`cancelled` guard

4. Corrigir o contrato do `AuthContext`
   - Expor exatamente o que a UI usa:
     - `signInWithGoogle`
     - `signOut`
     - `loading`
     - `user`
     - `session`
     - `profile`
     - `isAdmin`
     - `isSdr`
     - `isCloser`
   - Isso remove inconsistências entre `AuthContext`, `Login`, `useLeads` e páginas protegidas

5. Ajustar a busca de perfil
   - Buscar `user_profiles` por chave estável (`user_id`) em vez de depender só de email
   - Se necessário, manter fallback por email para compatibilidade com dados antigos
   - Normalizar email em lowercase
   - Se o usuário existir mas o perfil não existir:
     - parar o loading
     - mostrar “Acesso negado / perfil não configurado”
     - nunca deixar spinner infinito

6. Corrigir o fluxo de rota no `App.tsx`
   - Não deixar a aplicação decidir redirect enquanto `loading === true`
   - Criar um bootstrap de rota para `/` em vez de `Navigate` cego para `/pipeline`
   - Fluxo final:
     - app abre → spinner
     - callback é processado
     - sessão é aplicada
     - perfil é buscado
     - só então redireciona para área autenticada ou login

7. Corrigir o login da página `Login.tsx`
   - Consumir `signInWithGoogle` real do contexto
   - Enquanto `loading`, mostrar apenas estado de carregamento
   - Se `user && profile`, navegar
   - Se `user && !profile`, mostrar bloqueio de acesso
   - Se `!user`, mostrar botão Google

8. Validar o restante da área autenticada
   - Garantir que `useLeads.ts` só filtre por closer depois que `profile` estiver disponível
   - Garantir que subscriptions realtime não dependam de um contexto quebrado
   - Verificar se `Pipeline`/`Sidebar` não estão assumindo campos inexistentes

Arquivos que eu vou ajustar

- `src/contexts/AuthContext.tsx`
- `src/App.tsx`
- `src/pages/Login.tsx`
- `src/lib/supabase.ts`
- `src/hooks/useLeads.ts`
- `src/components/AppSidebar.tsx`
- `supabase/functions/webhook-zapier/index.ts`

Detalhes técnicos

- Ordem correta do bootstrap:
  1. `onAuthStateChange(...)`
  2. `getSession()`
  3. `applySession(...)`
  4. `setLoading(false)`

- Regra de redirect:
  - nunca redirecionar para `/login` enquanto `loading` for `true`

- Regra de perfil:
  - ausência de perfil = acesso negado
  - ausência de sessão = login
  - nenhuma dessas situações pode deixar loading preso

Resultado esperado

Depois da correção, o fluxo ficará assim:

- usuário clica em “Entrar com Google”
- volta do Google para o app
- o app mostra loading temporário
- o callback é processado corretamente
- a sessão é criada
- o perfil é buscado
- o usuário entra no app sem voltar indevidamente para `/login`

Também vou deixar o projeto compilando de novo, porque hoje há erros paralelos que impedem validar a correção com segurança.
