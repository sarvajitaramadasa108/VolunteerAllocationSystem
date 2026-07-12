import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="hero">
        <p className="eyebrow">Volunteer Allocation</p>
        <h1>Service desk and volunteer lookup</h1>
        <p className="hero-copy">
          Search a mobile number from the master sheet, register a new volunteer when needed,
          and allocate service from the service master.
        </p>
      </section>

      <section className="card-grid">
        <Link className="card-link" href="/allocate">
          <h2>Allocation Desk</h2>
          <p>Search by mobile, see volunteer details, and assign a service.</p>
        </Link>
        <Link className="card-link" href="/lookup">
          <h2>Volunteer Check</h2>
          <p>Enter a mobile number to see the allocated service and coordinator details.</p>
        </Link>
      </section>
    </main>
  );
}
