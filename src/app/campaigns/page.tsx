import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; sent?: string; failed?: string; error?: string; template?: string; legacy_template?: string; status?: string; code?: string }>;
}) {
  const params = await searchParams;

  if (!hasSupabaseServerEnv()) {
    return <main className="shell"><h1>Campaigns</h1><p className="muted">Connect Supabase to load campaigns.</p></main>;
  }

  const supabase = createAdminClient();
  const [{ data }, { data: templates }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,template_name,language_code,status,target_filter,use_name_parameter,scheduled_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("meta_templates")
      .select("meta_template_id,name,language,category,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <main className="shell">
      <div className="topbar">
        <div><div className="brand">Campaigns</div><div className="muted">Meta template campaigns</div></div>
        <AdminNav />
      </div>

      <section className="card">
        <h2>Sea N Shore launch template</h2>
        <p className="muted">
          Submit the first production marketing template to Meta for review. It links to seanshore.in and includes an opt-out instruction.
        </p>
        {params.template === "submitted" ? <p><strong>Template submitted to Meta.</strong> Status: {params.status || "PENDING"}</p> : null}
        {params.template === "existing" ? <p><strong>Template already exists in this platform.</strong> Status: {params.status || "UNKNOWN"}</p> : null}
        {params.template === "missing_env" ? <p style={{ color:"#9b1c1c", fontWeight:700 }}>Meta production configuration is incomplete.</p> : null}
        {params.template === "error" ? <p style={{ color:"#9b1c1c", fontWeight:700 }}>Meta rejected the template submission{params.code ? ` (error ${params.code})` : ""}.</p> : null}
        <form method="post" action="/api/meta/create-launch-template">
          <button className="button" type="submit">Submit Sea N Shore launch template</button>
        </form>
        {(templates ?? []).length ? (
          <table className="table" style={{ marginTop: 18 }}>
            <thead><tr><th>Template</th><th>Language</th><th>Category</th><th>Meta status</th></tr></thead>
            <tbody>
              {(templates ?? []).map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{t.language}</td>
                  <td>{t.category}</td>
                  <td><strong>{t.status || "UNKNOWN"}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="card section">
        <h2>Old account claim template</h2>
        <p className="muted">
          Image + personalized old-account reminder + Claim My Account button. Footer: Sea N Shore - Global Shipping Community.
        </p>
        {params.legacy_template === "submitted" ? <p><strong>Legacy claim template submitted to Meta.</strong> Status: {params.status || "PENDING"}</p> : null}
        {params.legacy_template === "existing" ? <p><strong>Legacy claim template already exists.</strong> Status: {params.status || "UNKNOWN"}</p> : null}
        {params.legacy_template === "missing_env" ? <p style={{ color:"#9b1c1c", fontWeight:700 }}>Meta production configuration is incomplete.</p> : null}
        {params.legacy_template === "error" ? <p style={{ color:"#9b1c1c", fontWeight:700 }}>Meta rejected the legacy claim template submission{params.code ? ` (error ${params.code})` : ""}.</p> : null}
        {params.legacy_template === "exception" ? <p style={{ color:"#9b1c1c", fontWeight:700 }}>Legacy claim template submission failed before Meta accepted it. Check the audit log.</p> : null}
        <form method="post" action="/api/meta/submit-legacy-claim-template-once">
          <button className="button" type="submit">Submit old account claim template</button>
        </form>
      </section>

      <section className="card section">
        <h2>Create campaign</h2>
        <p className="muted">Use the exact approved Meta template name. Sending is limited to contacts marked eligible and not opted out.</p>
        {params.created ? <p><strong>Campaign created.</strong></p> : null}
        {params.sent ? <p><strong>{params.sent}</strong> message(s) submitted · <strong>{params.failed || "0"}</strong> failed in this batch.</p> : null}
        {params.error ? <p style={{ color: "#9b1c1c", fontWeight: 700 }}>Campaign error: {params.error}</p> : null}

        <form method="post" action="/api/campaigns/create">
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <label>Campaign name<input name="name" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
            <label>Meta template name<input name="template_name" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
            <label>Language code<input name="language_code" defaultValue="en_US" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
            <label>Category filter<input name="category" placeholder="Leave blank for all" style={{ width:"100%", padding:10, marginTop:6 }} /></label>
          </div>
          <label style={{ display:"block", marginTop:14 }}>
            <input name="use_name_parameter" type="checkbox" /> Template body expects the contact name as parameter 1
          </label>
          <button className="button" type="submit" style={{ marginTop:14 }}>Create campaign</button>
        </form>
      </section>

      <section className="card section">
        <table className="table">
          <thead><tr><th>Name</th><th>Template</th><th>Audience</th><th>Status</th><th>Send</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.template_name}<br/><span className="muted">{c.language_code}</span></td>
                <td>{(c.target_filter as { category?: string } | null)?.category || "All eligible contacts"}</td>
                <td>{c.status}</td>
                <td>
                  {hasWhatsAppEnv() ? (
                    <form method="post" action="/api/campaigns/send">
                      <input type="hidden" name="campaignId" value={c.id} />
                      <input type="hidden" name="limit" value="25" />
                      <button className="button" type="submit">Send next 25</button>
                    </form>
                  ) : <span className="muted">Connect Meta first</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
