// Envia Push Notifications via Firebase Cloud Messaging (HTTP v1 API)
// e registra cada notificação na tabela `notifications`.
//
// Body esperado:
// {
//   title: string,
//   body: string,
//   user_ids?: string[]       // se omitido => envia para todos
//   data?: Record<string,string>
// }
//
// Requer secrets:
// - FIREBASE_PROJECT_ID
// - FIREBASE_CLIENT_EMAIL
// - FIREBASE_PRIVATE_KEY  (com \n escapados)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  title: string;
  body: string;
  user_ids?: string[];
  data?: Record<string, string>;
}

async function getAccessToken(): Promise<string> {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = Deno.env.get("FIREBASE_PRIVATE_KEY");
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Faltam credenciais Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Importa chave PEM
  const pemBody = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("OAuth token: " + JSON.stringify(json));
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body.title || !body.body) {
      return new Response(JSON.stringify({ error: "title e body são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user_ids alvo
    let targetUserIds = body.user_ids;
    if (!targetUserIds || targetUserIds.length === 0) {
      const { data: allTokens } = await supabase.from("device_tokens").select("user_id");
      targetUserIds = Array.from(new Set((allTokens ?? []).map((r) => r.user_id as string)));
    }

    // Cria registros de notificação (mesmo sem token)
    if (targetUserIds.length > 0) {
      await supabase.from("notifications").insert(
        targetUserIds.map((uid) => ({
          user_id: uid,
          title: body.title,
          body: body.body,
          data: body.data ?? null,
          created_by: userData.user!.id,
        })),
      );
    }

    // Busca tokens dos alvos
    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token, user_id")
      .in("user_id", targetUserIds);

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    if (tokens && tokens.length > 0) {
      const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
      const accessToken = await getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

      for (const t of tokens) {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title: body.title, body: body.body },
              data: body.data ?? {},
            },
          }),
        });
        if (res.ok) {
          sent++;
        } else {
          failed++;
          const errBody = await res.text();
          if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(errBody)) {
            invalidTokens.push(t.token);
          }
          console.warn("FCM erro:", res.status, errBody);
        }
      }

      if (invalidTokens.length > 0) {
        await supabase.from("device_tokens").delete().in("token", invalidTokens);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, recipients: targetUserIds.length, tokens: tokens?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
