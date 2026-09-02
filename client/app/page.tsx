import Link from 'next/link';
import { LayoutDashboard, MonitorPlay } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="landing">
      <section className="landing__card">
        <h1>YTChatHub</h1>
        <p>Watch a YouTube Live chat, pick a message, and it appears on your OBS overlay.</p>
        <div className="landing__links">
          <Link className="btn btn--primary" href="/dashboard/">
            <LayoutDashboard size={15} />
            Open dashboard
          </Link>
          <Link className="btn" href="/overlay/">
            <MonitorPlay size={15} />
            Overlay for OBS
          </Link>
        </div>
      </section>
    </main>
  );
}
