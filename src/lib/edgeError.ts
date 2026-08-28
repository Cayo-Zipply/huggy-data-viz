/**
 * Lê o corpo JSON de um erro de `supabase.functions.invoke`.
 * Em FunctionsHttpError o corpo real vem em `error.context` (Response).
 */
export async function readEdgeErrorBody(error: any): Promise<any | null> {
  try {
    const ctx = error?.context;
    if (!ctx) return null;
    if (typeof ctx.json === "function") {
      try {
        return await (typeof ctx.clone === "function" ? ctx.clone() : ctx).json();
      } catch {
        try {
          const txt = await (typeof ctx.clone === "function" ? ctx.clone() : ctx).text();
          return txt ? JSON.parse(txt) : null;
        } catch {
          return null;
        }
      }
    }
    if (typeof ctx.body === "string") {
      try { return JSON.parse(ctx.body); } catch { return null; }
    }
    if (ctx.body && typeof ctx.body === "object") return ctx.body;
  } catch {}
  return null;
}

/**
 * Monta uma mensagem legível a partir do corpo da edge function
 * (`error`, `detalhe`, `sugestao`, `google_status`), caindo no texto
 * genérico só quando não houver corpo JSON.
 */
export async function edgeErrorMessage(
  error: any,
  data?: any,
  fallback = "Erro inesperado",
): Promise<string> {
  const body = (await readEdgeErrorBody(error)) || (data && typeof data === "object" ? data : null);

  const partes: string[] = [];
  const principal = body?.error || body?.message || body?.detalhe;
  if (principal) partes.push(String(principal));
  if (body?.detalhe && body?.error && body.detalhe !== body.error) partes.push(String(body.detalhe));
  if (body?.sugestao) partes.push(String(body.sugestao));

  if (partes.length) {
    const status = body?.google_status || body?.calendar_status || body?.gmail_status;
    const prefix = status ? `[${status}] ` : "";
    return prefix + partes.join(" — ");
  }

  return error?.message || fallback;
}
