import { requiredAppEnvironmentVariables } from "@/application/member-flow/environment";

export function EnvironmentSetupNotice() {
  return (
    <main className="setup-page">
      <section className="setup-panel">
        <div className="brand"><span className="brand-mark">FN</span>Fairway Network</div>
        <h1>Development Auth And Persistence Required</h1>
        <p>Vertical Slice 1B is wired for real Clerk authentication and Supabase persistence. Add the development project values below to `.env.local`, then apply the Supabase migrations and seed data.</p>
        <ul>
          {requiredAppEnvironmentVariables().map((name) => <li key={name}><code>{name}</code></li>)}
        </ul>
      </section>
    </main>
  );
}
