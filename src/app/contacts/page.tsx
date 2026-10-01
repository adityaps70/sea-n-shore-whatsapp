import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/env";
import { AdminNav } from "@/components/admin-nav";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; rejected?: string; error?: string }>;
}) {
  const params = await searchParams;

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
      <div className="topbar">
        <div><div className="brand">Contacts</div><div className="muted">Latest 100 records</div></div>
        <AdminNav />
      </div>

      <section className="card">
        <h2>Import contacts</h2>
        <p className="muted">
          CSV headers can include: phone_e164/phone/mobile/whatsapp_no, name, email, category,
          country/nationality, old_whatsapp_field, consent_source and consent_at.
          Imported contacts stay <strong>unknown</strong> unless both consent_source and consent_at are supplied.
        </p>

        {params.imported ? (
          <p><strong>{params.imported}</strong> imported/upserted · <strong>{params.rejected || "0"}</strong> rejected</p>
        ) : null}
        {params.error ? <p style={{ color: "#9b1c1c", fontWeight: 700 }}>Import error: {params.error}</p> : null}

        <form method="post" action="/api/contacts/import" encType="multipart/form-data" className="stack">
          <input name="file" type="file" accept=".csv,text/csv" required />
          <button className="button" type="submit">Import CSV</button>
        </form>
      </section>

      <section className="card section">
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
