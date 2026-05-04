// Pré-cria/realinha contas (auth.users) para todos os atletas com telefone válido.
// - Cria conta nova se não existir.
// - Se o atleta já está vinculado (user_id) mas o email do auth NÃO é o sintético
//   "<digits>@phone.beachclub", ATUALIZA email + senha para permitir login por telefone.
// Senha inicial = "bc" + últimos 4 dígitos do telefone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function digitsOnly(s: string | null): string {
  if (!s) return "";
  return s.replace(/\D+/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);

    // Carrega todos os usuários auth (paginado) para lookup por email/id
    const allUsers: any[] = [];
    {
      let page = 1;
      while (page < 50) {
        const { data: list } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        const users = list?.users ?? [];
        allUsers.push(...users);
        if (users.length < 200) break;
        page++;
      }
    }
    const usersByEmail = new Map<string, any>();
    const usersById = new Map<string, any>();
    for (const u of allUsers) {
      if (u.email) usersByEmail.set(u.email.toLowerCase(), u);
      usersById.set(u.id, u);
    }

    // Carrega atletas
    const { data: athletes, error: aErr } = await admin
      .from("athletes")
      .select("id, full_name, phone, user_id");
    if (aErr) throw aErr;

    let created = 0;
    let linked = 0;
    let realigned = 0;
    const skipped: { name: string; reason: string }[] = [];

    for (const a of athletes ?? []) {
      const digits = digitsOnly(a.phone);
      if (digits.length < 10) {
        skipped.push({
          name: a.full_name,
          reason: digits ? `telefone curto (${digits})` : "sem telefone",
        });
        continue;
      }
      const email = `${digits}@phone.beachclub`;
      const last4 = digits.slice(-4);
      const password = `bc${last4}`;

      // Caso 1: já vinculado — garantir que email/senha permitam login por telefone
      if (a.user_id) {
        const existing = usersById.get(a.user_id);
        if (existing && (existing.email ?? "").toLowerCase() !== email) {
          // Se já existe outro usuário ocupando esse email sintético, pula
          const colliding = usersByEmail.get(email);
          if (colliding && colliding.id !== a.user_id) {
            skipped.push({
              name: a.full_name,
              reason: `email ${email} já em uso por outro usuário`,
            });
            continue;
          }
          const { error: upErr } = await admin.auth.admin.updateUserById(
            a.user_id,
            { email, password, email_confirm: true },
          );
          if (upErr) {
            skipped.push({ name: a.full_name, reason: upErr.message });
          } else {
            realigned++;
          }
        }
        continue;
      }

      // Caso 2: não vinculado — talvez já exista usuário com esse email sintético
      const existingByEmail = usersByEmail.get(email);
      if (existingByEmail) {
        await admin
          .from("athletes")
          .update({ user_id: existingByEmail.id })
          .eq("id", a.id);
        linked++;
        continue;
      }

      // Caso 3: criar novo
      const { data: createRes, error: cErr } = await admin.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: a.full_name, provisioned: true },
        });

      if (cErr) {
        skipped.push({ name: a.full_name, reason: cErr.message });
        continue;
      }
      if (createRes?.user) {
        await admin
          .from("athletes")
          .update({ user_id: createRes.user.id })
          .eq("id", a.id);
        created++;
      }
    }

    return new Response(
      JSON.stringify({ created, linked, realigned, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
