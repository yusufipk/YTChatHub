'use client';

import Link from 'next/link';
import { LayoutDashboard, MonitorPlay } from 'lucide-react';
import { useStrings } from '../lib/i18n';

export default function HomePage() {
  const t = useStrings();
  return (
    <main className="landing">
      <section className="landing__card">
        <h1>YTChatHub</h1>
        <p>{t.landingHint}</p>
        <div className="landing__links">
          <Link className="btn btn--primary" href="/dashboard/">
            <LayoutDashboard size={15} />
            {t.openDashboard}
          </Link>
          <Link className="btn" href="/overlay/">
            <MonitorPlay size={15} />
            {t.overlayForObs}
          </Link>
        </div>
      </section>
    </main>
  );
}
