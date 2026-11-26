import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileIdentity = { user_id: string | null; role: string | null };
type ProfileClient = Pick<SupabaseClient, "from">;

export function deletionBlockReason(profile: ProfileIdentity, currentUserId: string | undefined, users: ProfileIdentity[]) {
  if (currentUserId && profile.user_id === currentUserId) return "Você não pode excluir o seu próprio usuário";
  if (profile.role === "admin" && users.filter((u) => u.role === "admin").length <= 1) return "É preciso existir ao menos um administrador";
  return null;
}

export function firstNameMatches(name: string, confirmation: string) {
  const firstName = name.trim().split(/\s+/)[0];
  return Boolean(firstName) && confirmation.trim().toLocaleLowerCase("pt-BR") === firstName.toLocaleLowerCase("pt-BR");
}

export async function deleteUserProfile(client: ProfileClient, profileId: string) {
  const { data, error } = await client.from("user_profiles").delete().eq("id", profileId).select("id");
  if (error) throw new Error("Não foi possível excluir: " + error.message);
  if (!data?.length) throw new Error("Sem permissão para excluir este usuário.");
}

/** Look up/link an existing invitation; never recreate a removed profile. */
export async function findExistingProfile(client: ProfileClient, userId: string, email: string) {
  const byId = await client.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (byId.error) throw byId.error;
  if (byId.data) return byId.data;
  const byEmail = await client.from("user_profiles").select("*").eq("email", email.toLowerCase().trim()).is("user_id", null).maybeSingle();
  if (byEmail.error) throw byEmail.error;
  if (!byEmail.data) return null;
  const linked = await client.from("user_profiles").update({ user_id: userId }).eq("id", byEmail.data.id).is("user_id", null).select("*").maybeSingle();
  if (linked.error) throw linked.error;
  return linked.data;
}
