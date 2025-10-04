import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing">
      <section className="panel">
        <h1>YouTube Chat Client</h1>
        <p>
          Launch the dashboard to monitor live chat and control the overlay that feeds OBS.
        </p>
        <Link className="primary" href="/dashboard">
          Open Dashboard
        </Link>
        <p className="muted">Overlay preview lives at /overlay for the OBS browser source.</p>
      </section>
    </main>
  );
}
