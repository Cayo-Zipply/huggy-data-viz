const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, description, screenshot, user_name, user_email, page } = await req.json();

    if (!description?.trim()) {
      return new Response(JSON.stringify({ success: false, message: "Descrição é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      return new Response(JSON.stringify({ success: false, message: "Webhook não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emoji = type === "bug" ? "🐛" : "💡";
    const typeLabel = type === "bug" ? "Bug Report" : "Sugestão de Melhoria";

    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} ${typeLabel}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Usuário:*\n${user_name || "Desconhecido"}` },
          { type: "mrkdwn", text: `*Email:*\n${user_email || "N/A"}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Descrição:*\n${description}` },
      },
    ];

    if (page) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `📍 Página: ${page}` }],
      });
    }

    if (screenshot) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `📎 _Screenshot anexado pelo usuário (base64 — não exibível no Slack)_` }],
      });
    }

    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `🕐 ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` }],
    });

    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!slackRes.ok) {
      const errText = await slackRes.text();
      throw new Error(`Slack error: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Feedback error:", e.message);
    return new Response(JSON.stringify({ success: false, message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
