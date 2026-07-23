import { supabase } from "@/integrations/supabase/client";

const PRIMARY_DOMAIN = "dispel.operacao";
const FALLBACK_DOMAINS = ["dispel.local"];

const normalize = (username: string) =>
  username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "");

export const usernameToEmail = (username: string) => `${normalize(username)}@${PRIMARY_DOMAIN}`;

export async function signInWithUsername(username: string, password: string) {
  const user = normalize(username);
  const domains = [PRIMARY_DOMAIN, ...FALLBACK_DOMAINS];
  let lastResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>> | null = null;
  for (const d of domains) {
    const res = await supabase.auth.signInWithPassword({ email: `${user}@${d}`, password });
    if (!res.error) return res;
    lastResult = res;
    // Only try next domain if credentials were rejected (user not found here)
    const msg = res.error.message?.toLowerCase() ?? "";
    if (!msg.includes("invalid") && !msg.includes("credentials")) break;
  }
  return lastResult!;
}

export async function signUpWithUsername(username: string, password: string, displayName?: string) {
  return supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: { username: username.trim(), display_name: displayName ?? username.trim() },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
