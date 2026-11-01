import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply({ error: "Server configuration missing" }, 500);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return reply({ error: "Invalid session" }, 401);
  if (user.app_metadata?.role !== "admin") return reply({ error: "Admin access required" }, 403);

  let body: { action?: string; request_id?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid JSON body" }, 400);
  }

  if (body.action === "list") {
    const { data, error } = await adminClient
      .from("tc_premium_payment_requests")
      .select("id,user_id,plan_days,amount,utr,payment_app,status,created_at,reviewed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return reply({ error: "Could not load payment requests" }, 500);

    const requests = await Promise.all((data || []).map(async (item) => {
      const { data: account } = await adminClient.auth.admin.getUserById(item.user_id);
      return { ...item, email: account?.user?.email || "Unknown account" };
    }));
    return reply({ requests });
  }

  if (body.action === "review") {
    if (!body.request_id || !["approve", "reject"].includes(body.decision || "")) {
      return reply({ error: "Request ID and valid decision are required" }, 400);
    }
    const { data, error } = await adminClient.rpc("tc_admin_review_premium_payment", {
      p_request_id: body.request_id,
      p_decision: body.decision,
      p_admin_id: user.id,
    });
    if (error) return reply({ error: error.message || "Review could not be completed" }, 400);
    return reply({ result: data });
  }

  return reply({ error: "Unknown action" }, 400);
});
