import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv, hasWhatsAppEnv } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; sent?: string; failed?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (!hasSupabaseServerEnv()) {
    return <main className="shell"><h1>Campaigns</h1><p className="muted">Connect Supabase to load campaigns.</p></main>;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id,name,template_name,language_code,status,target_filter,use_name_parameter,scheduled_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="shell">
      <div className="topbar">
        <div><div className="brand">Campaigns</div><div className="muted">Meta template campaigns</div></div>
        <AdminNav />
      </div>

      <section className="card">
        <h2>Create campaign</h2>
        <p className="muted">Use the exact approved Meta template name. Sending is limited to contacts marked eligible and not opted out.</p>
        {params.created ? <p><strong>Campaign created.</strong></p> : null}
        {params.sent ? <p><strong>{params.sent}</strong> message(s) submitted · <strong>{params.failed || "0"}</strong> failed in this batch.</p> : null}
        {params.error ? <p style={{ color: "#9b1c1c", fontWeight: 700 }}>Campaign error: {params.error}</p> : null}

        <form method="post" action="/api/campaigns/create">
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <label>Campaign name<input name="name" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
            <label>Meta template name<input name="template_name" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
            <label>Language code<input name="language_code" defaultValue="en" required style={{ width:"100%", padding:10, marginTop:6 }} /></label>
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
