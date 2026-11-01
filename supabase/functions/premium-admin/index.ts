import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!token) return reply({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Server configuration missing" }, 500);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const admin = auth?.user;
  if (authError || !admin) return reply({ error: "Invalid session" }, 401);
  if (admin.app_metadata?.role !== "admin") return reply({ error: "Admin access required" }, 403);

  let body: { action?: string; request_id?: string; decision?: string; ticket_id?: string; message?: string; status?: string; title?: string; text?: string; user_id?: string; kind?: string; is_published?: boolean };
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON body" }, 400); }

  if (body.action === "dashboard") {
    const [users, pending, active, tickets, announcements] = await Promise.all([
      db.auth.admin.listUsers({ page: 1, perPage: 1 }),
      db.from("tc_premium_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("tc_premium_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").gt("expires_at", new Date().toISOString()),
      db.from("tc_support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]),
      db.from("tc_announcements").select("id", { count: "exact", head: true }).eq("is_published", true),
    ]);
    if (pending.error || active.error || tickets.error || announcements.error) return reply({ error: "Dashboard data unavailable" }, 500);
    const { count: userCount } = await db.from("tc_profiles").select("id", { count: "exact", head: true });
    return reply({ stats: { users: userCount ?? users.data?.users?.length ?? 0, pending_payments: pending.count ?? 0, active_premium: active.count ?? 0, open_tickets: tickets.count ?? 0, published_announcements: announcements.count ?? 0 } });
  }

  if (body.action === "list") {
    const { data, error } = await db.from("tc_premium_payment_requests")
      .select("id,user_id,plan_days,amount,utr,payment_app,status,created_at,reviewed_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return reply({ error: "Could not load payment requests" }, 500);
    const requests = await Promise.all((data || []).map(async (item) => {
      const { data: account } = await db.auth.admin.getUserById(item.user_id);
      return { ...item, email: account?.user?.email || "Unknown account" };
    }));
    return reply({ requests });
  }

  if (body.action === "review") {
    if (!body.request_id || !["approve", "reject"].includes(body.decision || "")) return reply({ error: "Request ID and valid decision are required" }, 400);
    const { data, error } = await db.rpc("tc_admin_review_premium_payment", { p_request_id: body.request_id, p_decision: body.decision, p_admin_id: admin.id });
    if (error) return reply({ error: error.message || "Review could not be completed" }, 400);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: "premium_payment_" + body.decision, target_type: "premium_payment_request", target_id: body.request_id });
    return reply({ result: data });
  }

  if (body.action === "tickets") {
    const { data, error } = await db.from("tc_support_tickets").select("id,user_id,subject,status,created_at,updated_at").order("updated_at", { ascending: false }).limit(100);
    if (error) return reply({ error: "Could not load support tickets" }, 500);
    const tickets = await Promise.all((data || []).map(async (item) => {
      const [{ data: account }, { count }] = await Promise.all([
        db.auth.admin.getUserById(item.user_id),
        db.from("tc_support_messages").select("id", { count: "exact", head: true }).eq("ticket_id", item.id),
      ]);
      return { ...item, email: account?.user?.email || "Unknown account", message_count: count ?? 0 };
    }));
    return reply({ tickets });
  }

  if (body.action === "ticket_messages") {
    if (!body.ticket_id) return reply({ error: "Ticket ID required" }, 400);
    const { data, error } = await db.from("tc_support_messages").select("id,ticket_id,sender_id,sender_type,message,created_at").eq("ticket_id", body.ticket_id).order("created_at", { ascending: true }).limit(200);
    if (error) return reply({ error: "Could not load ticket messages" }, 500);
    return reply({ messages: data || [] });
  }

  if (body.action === "ticket_reply") {
    if (!body.ticket_id || !body.message?.trim() || body.message.trim().length > 4000) return reply({ error: "Ticket ID and a message up to 4000 characters are required" }, 400);
    const { error } = await db.from("tc_support_messages").insert({ ticket_id: body.ticket_id, sender_id: admin.id, sender_type: "support", message: body.message.trim() });
    if (error) return reply({ error: "Could not send support reply" }, 400);
    await db.from("tc_support_tickets").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", body.ticket_id);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: "support_ticket_replied", target_type: "support_ticket", target_id: body.ticket_id });
    return reply({ ok: true });
  }

  if (body.action === "ticket_status") {
    if (!body.ticket_id || !["open", "pending", "closed"].includes(body.status || "")) return reply({ error: "Ticket ID and valid status required" }, 400);
    const { error } = await db.from("tc_support_tickets").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.ticket_id);
    if (error) return reply({ error: "Could not update ticket status" }, 400);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: "support_ticket_status_" + body.status, target_type: "support_ticket", target_id: body.ticket_id });
    return reply({ ok: true });
  }

  if (body.action === "announcements") {
    const { data, error } = await db.from("tc_announcements").select("id,title,body,is_published,published_at,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) return reply({ error: "Could not load announcements" }, 500);
    return reply({ announcements: data || [] });
  }

  if (body.action === "create_announcement") {
    const title = body.title?.trim() || "";
    const text = body.text?.trim() || "";
    if (!title || title.length > 120 || !text || text.length > 5000) return reply({ error: "Title (1-120) and announcement text (1-5000) are required" }, 400);
    const published = body.is_published === true;
    const { data, error } = await db.from("tc_announcements").insert({ title, body: text, is_published: published, published_at: published ? new Date().toISOString() : null }).select("id,title,body,is_published,published_at,created_at").single();
    if (error) return reply({ error: "Could not save announcement" }, 400);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: published ? "announcement_published" : "announcement_drafted", target_type: "announcement", target_id: data.id });
    return reply({ announcement: data });
  }

  if (body.action === "publish_announcement") {
    if (!body.request_id) return reply({ error: "Announcement ID required" }, 400);
    const { error } = await db.from("tc_announcements").update({ is_published: body.is_published === true, published_at: body.is_published === true ? new Date().toISOString() : null }).eq("id", body.request_id);
    if (error) return reply({ error: "Could not update announcement" }, 400);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: body.is_published === true ? "announcement_published" : "announcement_unpublished", target_type: "announcement", target_id: body.request_id });
    return reply({ ok: true });
  }

  if (body.action === "send_notification") {
    const title = body.title?.trim() || "";
    const text = body.text?.trim() || "";
    const kind = body.kind || "general";
    if (!body.user_id || !title || title.length > 120 || !text || text.length > 2000 || !["general", "support", "account", "system"].includes(kind)) return reply({ error: "Valid user ID, title, message and notification type are required" }, 400);
    const { data: recipient } = await db.auth.admin.getUserById(body.user_id);
    if (!recipient?.user) return reply({ error: "User not found" }, 404);
    const { error } = await db.from("tc_notifications").insert({ user_id: body.user_id, title, body: text, kind });
    if (error) return reply({ error: "Could not send notification" }, 400);
    await db.from("tc_audit_events").insert({ actor_id: admin.id, event_type: "notification_sent", target_type: "user", target_id: body.user_id });
    return reply({ ok: true });
  }

  return reply({ error: "Unknown action" }, 400);
});
