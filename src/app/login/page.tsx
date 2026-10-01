export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell" style={{ maxWidth: 520 }}>
      <section className="card" style={{ marginTop: 80 }}>
        <div className="brand">Sea N Shore · WhatsApp</div>
        <p className="muted">Admin access only</p>

        {params.error ? (
          <p style={{ color: "#9b1c1c", fontWeight: 700 }}>
            Invalid email or password.
          </p>
        ) : null}

        <form method="post" action="/api/auth/login">
          <input type="hidden" name="next" value={params.next || "/"} />

          <label htmlFor="email"><strong>Email</strong></label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            style={{ width: "100%", padding: 12, margin: "8px 0 16px", border: "1px solid var(--line)", borderRadius: 10 }}
          />

          <label htmlFor="password"><strong>Password</strong></label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{ width: "100%", padding: 12, margin: "8px 0 18px", border: "1px solid var(--line)", borderRadius: 10 }}
          />

          <button className="button" type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
