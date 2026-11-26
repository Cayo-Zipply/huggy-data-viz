# Termo de adesão do relatório
- [x] Ajustar modalidade, formulário e pagamento do termo sem alterar mensalidade.
- [x] Ajustar check, ações de geração, avisos e rótulo do card.
- [x] Verificar regras e telas com dados controlados; testes passaram. Sessão real indisponível: geração/assinatura autenticada não verificada.
- [x] Conferir documento reenviado: aviso de placeholders já aparece após geração; ajustar rótulo de download do termo já gerado.

# Vendas para CPF
- [x] Destacar CPF perto do nome no Kanban e no detalhe do lead.
- [x] Usar CPF / CNPJ e formatDocumento na edição do documento.
- [x] Liberar UF/endereço para CPF ao agendar sem alterar CNPJ; testes unitários e navegador com dados controlados passaram, sem criar reunião real.

# Localização da equipe
- [x] Usar somente permissão nativa, sem aviso próprio, e coleta visível ao montar e a cada cinco minutos, sem alterar pings normais.
- [x] Exibir localização e etiquetas no painel administrativo sem alterar o banco.
- [x] Testar permissão, intervalos e estados de localização com testes unitários e navegador controlado; integração autenticada não verificada.

# Atualização de versão
- [x] Verificar versão no layout autenticado a cada três minutos e avisar sem interromper a aba ativa.
- [x] Adicionar comando administrativo com confirmação para sinalizar nova versão a todos.
- [x] Testar versão inicial, mudança de versão e comportamento por visibilidade; testes unitários e navegador controlado passaram, integração autenticada não verificada.
# Marketing Meta (Campanhas + Criativos)
- [x] Tela Campanhas (admin): overview, status, orçamento, anúncios só leitura, histórico de ações.
- [x] Biblioteca de criativos (admin): adicionar vídeo, grid, enviar ao Meta com acompanhamento, funil por criativo 30 dias.
- [x] Corrigir card "Reuniões realizadas" do Marketing para contar leads perdidos.

# Horários de atendimento
- [x] Tela, menu, atalho no pipe e pop-up de segunda; sem teste autenticado.
- [x] Adicionar almoço padrão e exibir bloqueios efetivos dos próximos 14 dias, sem alterar outras telas ou banco.
- [ ] Completar edição de ausências/almoço por data: aguarda continuação do arquivo enviado, interrompido no item 2.
- [x] Verificar almoço e etiquetas: 11 testes passaram; inserir/reabrir/editar/remover e falha de remoção conferidos no navegador com dados simulados em claro/escuro e 390/1001px. Sessão real não verificada.

# Cabeçalho do Pipe
- [x] Reorganizar navegação SDR/Closer/Todos, ações e filtros sem alterar regras, permissões ou Kanban.
- [x] Conferir cabeçalho, troca de Pipe, menu e Novo Lead em 1440/1002/390px, claro/escuro, com dados simulados; sessão real indisponível.
