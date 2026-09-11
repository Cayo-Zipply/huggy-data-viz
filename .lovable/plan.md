# Pergunta sobre débitos no contrato

## Implementação
- Incluir no modelo do lead e no carregamento do Pipe as cinco colunas já existentes de débitos.
- Adicionar, na área de contrato, a pergunta obrigatória com três checkboxes, exclusividade imediata e salvamento direto.
- Reconsultar somente essas colunas após salvar para exibir autor e data registrados pelo banco.
- Bloquear ZapSign, download e WhatsApp sem resposta, mantendo a prévia liberada e mostrando a orientação em tooltip.
- Fazer o item `debitos_entes` do popup fechar o aviso, rolar até a pergunta e destacá-la.
- Tratar respostas 400 com `missing: ["debitos_entes"]` com a mensagem específica e rolagem.
- Exibir o resumo da resposta junto aos dados do contrato, inclusive no modo já gerado.

## Detalhes técnicos
- Alterações somente no frontend, sem mudar corpos das chamadas existentes e sem criar dependências ou objetos no banco.
- Usar os componentes visuais existentes e atualizar o estado local do Pipe após a confirmação do banco.
- Validar compilação e os estados principais da tela.
