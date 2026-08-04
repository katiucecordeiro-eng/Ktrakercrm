import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/frota/types";

// Rota "home" de cada papel — usada tanto no redirect pós-login quanto no
// guard de página quando o usuário tenta acessar um painel que não é o seu.
export const ROLE_HOME: Record<Role, string> = {
  unidade: "/unidade",
  suprimentos: "/fila",
  frota_corporativo: "/governanca",
};

// Busca o profile (role + unidade) do usuário autenticado. Retorna null se
// não houver sessão — quem chama decide se isso significa redirect pro
// login (o proxy.ts já cobre a maioria dos casos, isso é defesa em
// profundidade para Server Components/Actions chamados diretamente).
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role, unidade")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

// Garante que o usuário logado tem o papel esperado para ver essa página;
// caso contrário manda pra home do papel real dele (ou pro login, sem
// sessão). Usar no topo de cada layout de painel ((suprimentos), (unidade),
// (governanca)).
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== role) {
    redirect(ROLE_HOME[profile.role]);
  }

  return profile;
}
