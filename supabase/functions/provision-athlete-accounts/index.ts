// Pré-cria contas (auth.users) para todos os atletas com telefone válido.
// Senha inicial = "bc" + últimos 4 dígitos do telefone (6 chars, atende mínimo).
// Email sintético = "<digitos>@phone.beachclub". O trigger handle_new_user
// cuida de vincular athletes.user_id automaticamente.

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

    // Carrega atletas
    const { data: athletes, error: aErr } = await admin
      .from("athletes")
      .select("id, full_name, phone, user_id");
    if (aErr) throw aErr;

    let created = 0;
    let linked = 0;
    let skipped: { name: string; reason: string }[] = [];

    for (const a of athletes ?? []) {
      if (a.user_id) continue;
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

      // Já existe usuário com esse email?
      const { data: existing } = await admin
        .from("athletes")
        .select("id")
        .limit(1); // dummy; we use admin.auth.admin.listUsers via filter below
      void existing;

      const { data: lookup, error: lookErr } = await admin.auth.admin
        .listUsers({ page: 1, perPage: 1 });
      void lookup;
      void lookErr;

      // listUsers não filtra por email; usamos createUser e tratamos erro de duplicado
      const { data: createRes, error: cErr } = await admin.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: a.full_name, provisioned: true },
        });

      if (cErr) {
        // Já existe — tenta achar e vincular manualmente
        const msg = String(cErr.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          // Procura via listUsers paginado pelo email
          let foundId: string | null = null;
          let page = 1;
          while (page < 50) {
            const { data: list } = await admin.auth.admin.listUsers({
              page,
              perPage: 200,
            });
            const u = list?.users?.find(
              (x: any) => (x.email ?? "").toLowerCase() === email,
            );
            if (u) {
              foundId = u.id;
              break;
            }
            if (!list?.users?.length || list.users.length < 200) break;
            page++;
          }
          if (foundId) {
            await admin
              .from("athletes")
              .update({ user_id: foundId })
              .eq("id", a.id);
            linked++;
          } else {
            skipped.push({ name: a.full_name, reason: cErr.message });
          }
        } else {
          skipped.push({ name: a.full_name, reason: cErr.message });
        }
        continue;
      }

      // O trigger já vincula athletes.user_id, mas reforçamos
      if (createRes?.user) {
        await admin
          .from("athletes")
          .update({ user_id: createRes.user.id })
          .eq("id", a.id);
        created++;
      }
    }

    return new Response(
      JSON.stringify({ created, linked, skipped }),
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
