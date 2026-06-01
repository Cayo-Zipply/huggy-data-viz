## Objetivo
Na aba de Anexos do card do lead, melhorar a experiência com transcrições:
1. Adicionar opção de **baixar a transcrição em .docx (Word)**.
2. Adicionar opção de **expandir** a visualização da transcrição (modal em tela cheia / maior, com melhor leitura).

## Escopo
Apenas `src/components/lead/aba-anexos.tsx` (UI). Sem mudanças de backend, schema ou edge functions.

## Mudanças

### 1) Baixar como Word (.docx)
- Para anexos com `conteudo_texto` (transcrições), adicionar um botão extra "Baixar Word" ao lado dos botões já existentes (Visualizar, Baixar, Remover).
- Geração client-side de um `.docx` válido a partir do `conteudo_texto`, usando a lib `docx` (já comum no ecossistema; adicionar via `bun add docx` no momento da build).
  - Cada linha do texto vira um `Paragraph`.
  - Nome do arquivo: `<nome_arquivo sem extensão>.docx`.
- O botão "Baixar" atual continua baixando o `.txt` original (comportamento inalterado).

### 2) Expandir transcrição
- No modal de preview já existente (`Dialog` do `previewing`):
  - Aumentar para `max-w-5xl` e altura `max-h-[90vh]`, com `ScrollArea` ocupando `max-h-[78vh]`.
  - Adicionar um botão "Expandir / Recolher" no header que alterna entre tamanho normal (`max-w-2xl`) e tela cheia (`max-w-[95vw] max-h-[95vh]`).
  - Tipografia mais legível: `text-sm leading-relaxed`, padding maior, quebra de linha preservada (`whitespace-pre-wrap`).
  - Adicionar no header do modal os botões "Baixar .txt" e "Baixar Word" para conveniência.

## Fora do escopo
- Não mexer em outras abas, hooks, RLS, storage ou edge functions.
- Não alterar o fluxo de upload nem a notificação do Slack.
