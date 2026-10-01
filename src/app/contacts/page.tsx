import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/env";

export default async function ContactsPage() {
  if (!hasSupabaseServerEnv()) {
    return <main className="shell"><h1>Contacts</h1><p className="muted">Connect Supabase to load contacts.</p></main>;
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contacts")
    .select("id,full_name,phone_e164,category,marketing_status,old_whatsapp_field,opted_out_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="shell">
      <div className="topbar"><div><div className="brand">Contacts</div><div className="muted">Latest 100 records</div></div><a className="button secondary" href="/">Dashboard</a></div>
      <section className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Number</th><th>Category</th><th>Eligibility</th><th>Old WA field</th><th>Opted out</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.full_name || "—"}</td>
                <td>{c.phone_e164}</td>
                <td>{c.category || "—"}</td>
                <td>{c.marketing_status}</td>
                <td>{c.old_whatsapp_field ? "Yes" : "No"}</td>
                <td>{c.opted_out_at ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
