import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="home-shell">
      <section className="hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Choose a dashboard</h1>
        <p className="hero-copy">
          Festival setup lives in one place, and live registrations and exports live in another.
        </p>
      </section>

      <section className="card-grid">
        <Link className="card-link" href="/dashboard/festival">
          <h2>Festival & Service Master</h2>
          <p>Create festivals, edit services, set active festival, and manage coordinator details.</p>
        </Link>
        <Link className="card-link" href="/dashboard/registrations">
          <h2>Registrations Dashboard</h2>
          <p>View service-wise allotted volunteers and live registration activity with exports.</p>
        </Link>
      </section>
    </main>
  );
}
