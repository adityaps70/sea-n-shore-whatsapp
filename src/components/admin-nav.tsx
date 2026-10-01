export function AdminNav() {
  return (
    <div className="stack">
      <a className="button secondary" href="/">Dashboard</a>
      <a className="button secondary" href="/contacts">Contacts</a>
      <a className="button secondary" href="/campaigns">Campaigns</a>
      <form method="post" action="/api/auth/logout">
        <button className="button secondary" type="submit">Sign out</button>
      </form>
    </div>
  );
}
