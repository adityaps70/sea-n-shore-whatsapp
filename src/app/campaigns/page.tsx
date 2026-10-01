import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/env";

export default async function CampaignsPage() {
  if (!hasSupabaseServerEnv()) {
    return <main className="shell"><h1>Campaigns</h1><p className="muted">Connect Supabase to load campaigns.</p></main>;
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id,name,template_name,language_code,status,scheduled_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="shell">
      <div className="topbar"><div><div className="brand">Campaigns</div><div className="muted">Meta template campaigns</div></div><a className="button secondary" href="/">Dashboard</a></div>
      <section className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Template</th><th>Language</th><th>Status</th><th>Scheduled</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.template_name}</td><td>{c.language_code}</td><td>{c.status}</td>
                <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
