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

# Exclusão de usuários
- [x] Liberar exclusão com proteção ao próprio usuário/último admin e confirmação pelo primeiro nome.
- [x] Detectar perfil ausente sem recriá-lo, encerrar sessão e bloquear telas internas.
- [x] Validar com 12 testes unitários e navegador simulado: confirmação, admin, falha/zero linhas/sucesso e perfil ausente no login e na atualização; claro/escuro sem erros. Sessão real indisponível; banco e histórico não alterados.

# Black Ops — régua e selos
- [x] Exibir selos em lote, filtros e detalhe, sem novas escritas.
- [x] Renderizar critérios/guardrails por versão, fatos, ajustes e legenda dinâmica.
- [x] Ajustar evolução mensal e testar compatibilidade das réguas: 6 testes unitários e navegador com dados controlados, claro/escuro e mobile; uma consulta de selos em lote, sem escritas novas. Sessão de teste não acessa o CRM externo; validação com dados reais indisponível.

# Black Ops — reunião da semana e treinamento
- [x] Adicionar reunião atual, histórico e troca administrativa pela RPC existente.
- [x] Adicionar gaps, materiais privados e progresso do próprio usuário.
- [x] Adicionar biblioteca, cobertura e acompanhamento administrativos.
- [x] Testar com dados controlados: vendedor/admin, consultas sob demanda, semana/histórico/troca, CRUD e status, upload privado, filtro por closer, vídeo/PDF, assinatura e conclusão com falhas/sucesso, claro/escuro e mobile; sem mudanças no backend. Sessão temporária não acessa o CRM externo: integração com dados reais não verificada.

# Black Ops — reunião em destaque
- [x] Alternar mês/semana, histórico e troca administrativa com período explícito.
- [x] Reproduzir vídeo no card sob demanda, tratar erros e renovar uma vez sem persistir URL.
- [x] Validação: 23 testes unitários passaram; navegador com dados controlados conferiu vendedor/admin, histórico mensal/semanal, troca com p_periodo, reprodução, renovação única, quatro erros e mobile claro/escuro. Backend não alterado; sessão real indisponível, integração com Read AI real não verificada.

# Black Ops — correções de treinamento
- [x] Usar somente os alvos ativos da régua, títulos na biblioteca e erros do banco no toast.
- [x] Exibir vídeos em modal de tela inteira, preservando progresso e conclusão.
- [x] Listar todos os materiais aprovados para vendedores, agrupados por alvo e com recomendações.
- [x] Validar: 29 testes unitários passaram; navegador controlado conferiu catálogo sem gap para Luka/Fillipe simulados, 7 critérios/9 guardrails, erros de insert/update, progresso e conclusão, YouTube/Loom/Vimeo/vídeo privado, tela inteira 16:9 em claro/escuro/mobile. Conta temporária real redirecionou para login do CRM externo; dados reais e incorporação dos vídeos originais não verificados. Sem alterações em banco, views ou funções.

# Black Ops — Ver como no treinamento
- [x] Selecionar primeiro closer para admin e filtrar apenas suas duas views; vendedor sem filtros de identidade.
- [x] Corrigir estados vazios e exibir Todos os materiais também na visão administrativa.
- [x] Validar: 24 testes unitários passaram; navegador com dados controlados conferiu seleção inicial/deduplicação, Fillipe/Luka nas duas views, vendedor sem seletor/filtros, catálogo independente, conclusão e estados de vazio/erro em claro e mobile escuro. Sem alterações no banco; contas e conteúdos reais não verificados.

# Treinamento — página própria
- [ ] Separar rota/menu e acesso pelo Black Ops; manter gestão apenas para admin.
- [ ] Exibir destaque, fileiras, capas, progresso, gaps recolhidos e descrição no player.
- [ ] Adicionar capa opcional na biblioteca e corrigir associação por closer/código.
- [ ] Validar regras, navegação e telas; registrar limites da validação real.
