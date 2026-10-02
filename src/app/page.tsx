import { createAdminClient } from "@/lib/supabase/admin";
import { hasMetaWebhookConfigEnv, hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

async function getStats() {
  if (!hasSupabaseServerEnv()) {
    return { contacts: 0, eligible: 0, campaigns: 0, delivered: 0, recent: [] as Array<Record<string, unknown>>, latestInbound: null as null | { from_number: string; received_at: string }, latestService: null as null | { status: string; created_at: string; to_number: string } };
  }
  const supabase = createAdminClient();
  const [contacts, eligible, campaigns, delivered, recent, latestInbound, latestService] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("marketing_status", "eligible"),
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("*", { count: "exact", head: true }).in("status", ["delivered", "read"]),
    supabase.from("campaigns").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("inbound_messages").select("from_number,received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("service_messages").select("status,created_at,to_number").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    contacts: contacts.count ?? 0,
    eligible: eligible.count ?? 0,
    campaigns: campaigns.count ?? 0,
    delivered: delivered.count ?? 0,
    recent: recent.data ?? [],
    latestInbound: latestInbound.data ?? null,
    latestService: latestService.data ?? null,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ webhook?: string; code?: string; reply?: string }>;
}) {
  const params = await searchParams;
  const stats = await getStats();
  const supabaseReady = hasSupabaseServerEnv();
  const metaReady = hasWhatsAppEnv();
  const webhookConfigReady = hasMetaWebhookConfigEnv();

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="brand">Sea N Shore · WhatsApp</div>
          <div className="muted">Marketing operations console</div>
        </div>
        <AdminNav />
      </div>

      <section className="hero">
        <span className="badge">Standalone platform</span>
        <h1>Reach the right maritime audience—without losing control.</h1>
        <p>Contacts, consent, campaigns, templates and delivery status in one place.</p>
        <div className="stack" style={{ marginTop: 16 }}>
          <span className="badge">{supabaseReady ? "Supabase connected" : "Supabase pending"}</span>
          <span className="badge">{metaReady ? "Meta connected" : "Meta pending"}</span>
        </div>
      </section>

      <section className="grid section">
        <div className="card"><div className="muted">Contacts</div><div className="metric">{stats.contacts}</div></div>
        <div className="card"><div className="muted">Eligible to message</div><div className="metric">{stats.eligible}</div></div>
        <div className="card"><div className="muted">Campaigns</div><div className="metric">{stats.campaigns}</div></div>
        <div className="card"><div className="muted">Delivered / read</div><div className="metric">{stats.delivered}</div></div>
      </section>

      <section className="card section">
        <h2>Meta webhook</h2>
        <p className="muted">
          Configure the app-level WhatsApp messages webhook, then attach this WhatsApp Business Account to it.
        </p>
        {params.webhook === "success" ? (
          <p style={{ color: "var(--good)", fontWeight: 700 }}>Meta WhatsApp messages webhook configured and WABA subscribed successfully.</p>
        ) : null}
        {params.webhook === "missing_env" ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>META_APP_ID or another Meta webhook environment variable is missing.</p>
        ) : null}
        {params.webhook === "error" ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>
            Meta rejected the webhook setup{params.code ? ` (error ${params.code})` : ""}.
          </p>
        ) : null}
        <form method="post" action="/api/meta/configure-webhook">
          <button className="button" type="submit" disabled={!webhookConfigReady}>
            Configure Meta WhatsApp webhook
          </button>
        </form>
        {!webhookConfigReady ? <p className="muted">One or more required Meta/WhatsApp environment variables are missing.</p> : null}
      </section>

      <section className="card section">
        <h2>Production outbound test</h2>
        <p className="muted">
          Reply to the most recent inbound WhatsApp conversation while its 24-hour customer-service window is open.
        </p>
        {stats.latestInbound ? (
          <p className="muted">
            Latest inbound: {stats.latestInbound.from_number} · {new Date(stats.latestInbound.received_at).toLocaleString()}
          </p>
        ) : (
          <p className="muted">No inbound production message found yet.</p>
        )}
        {params.reply === "sent" ? (
          <p style={{ color: "var(--good)", fontWeight: 700 }}>
            Production test reply accepted by Meta. Delivery/read updates will arrive through the webhook.
          </p>
        ) : null}
        {params.reply === "no_open_window" ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>
            No inbound message exists within the last 24 hours. Send a WhatsApp message to Sea N Shore first.
          </p>
        ) : null}
        {params.reply === "missing_env" ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>WhatsApp or Supabase production configuration is incomplete.</p>
        ) : null}
        {params.reply === "error" ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>Meta rejected the outbound production test. Check the audit log.</p>
        ) : null}
        <form method="post" action="/api/meta/send-test-reply">
          <button className="button" type="submit" disabled={!stats.latestInbound || !metaReady || !supabaseReady}>
            Send production test reply
          </button>
        </form>
        {stats.latestService ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Latest outbound service message: {stats.latestService.status} · {stats.latestService.to_number} · {new Date(stats.latestService.created_at).toLocaleString()}
          </p>
        ) : null}
      </section>

      <section className="card section">
        <h2>Platform controls</h2>
        <div className="stack">
          <span className="badge">Admin login protected</span>
          <span className="badge">Consent required</span>
          <span className="badge">Opt-out enforced</span>
          <span className="badge">Template only</span>
          <span className="badge">Webhook tracked</span>
        </div>
      </section>

      <section className="card section">
        <h2>Recent campaigns</h2>
        {stats.recent.length === 0 ? (
          <p className="muted">No campaigns yet. Import contacts, then connect Meta WhatsApp Cloud API.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {stats.recent.map((c: any) => (
                <tr key={c.id}><td>{c.name}</td><td>{c.status}</td><td>{new Date(c.created_at).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
