import Link from "next/link";
import HomeServiceSummary from "@/components/HomeServiceSummary";

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
        <Link className="card-link" href="/register">
          <h2>Pre Registration</h2>
          <p>Search by mobile, complete missing details, and save volunteer registrations.</p>
        </Link>
        <Link className="card-link" href="/lookup">
          <h2>Event Day Lookup</h2>
          <p>Use on the event day to see the allocated service and coordinator details.</p>
        </Link>
        <Link className="card-link" href="/dashboard">
          <h2>Dashboard</h2>
          <p>Download the volunteers allotted for any service.</p>
        </Link>
        <Link className="card-link" href="/allocate">
          <h2>Allocation Desk</h2>
          <p>Admin-only desk for assigning services after registration.</p>
        </Link>
      </section>

      <HomeServiceSummary />
    </main>
  );
}
