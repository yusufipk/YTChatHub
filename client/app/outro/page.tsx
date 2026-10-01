'use client';

import type { Supporter } from '@shared/show';
import { Tux, type TuxAction } from '../../components/Tux';
import { formatNumber, showText, type ShowText } from '../../lib/showText';
import { useEvents } from '../../lib/useEvents';
import { FONT_HREF, useNow, useOverlayParams } from '../../lib/useShowOverlay';

const TUX_SLOT_MS = 5_000;
const TUX_OUTRO: TuxAction[] = ['wave', 'dance', 'laugh', 'walk', 'wave', 'jump'];

type Group = { title: string; rows: { name: string; detail?: string }[] };

/** Groups supporters by kind and folds repeat Super Chats from one person into a single row. */
function creditGroups(supporters: Supporter[], text: ShowText): Group[] {
  const supers = new Map<string, string[]>();
  const members = new Set<string>();
  const gifts = new Map<string, number>();
  for (const s of supporters) {
    if (s.kind === 'super') supers.set(s.name, [...(supers.get(s.name) ?? []), ...(s.detail ? [s.detail] : [])]);
    else if (s.kind === 'member') members.add(s.name);
    else gifts.set(s.name, (gifts.get(s.name) ?? 0) + (Number(s.detail) || 1));
  }
  const groups: Group[] = [
    { title: text.superChats, rows: [...supers].map(([name, amounts]) => ({ name, detail: amounts.join(', ') })) },
    { title: text.gifts, rows: [...gifts].map(([name, n]) => ({ name, detail: text.gifted(formatNumber(n, text)) })) },
    { title: text.members, rows: [...members].map((name) => ({ name })) }
  ];
  return groups.filter((g) => g.rows.length > 0);
}

export default function OutroPage() {
  const params = useOverlayParams();
  const { show, clockOffset } = useEvents();
  const now = useNow(clockOffset, false, 1000);
  const text = showText(params?.get('lang') ?? null);
  const outro = show?.outro;
  const stats = outro?.stats ?? null;
  const groups = stats ? creditGroups(stats.supporters, text) : [];
  const rows = groups.reduce((sum, g) => sum + g.rows.length + 2, 0);
  // Long lists roll faster so the credits end inside a one minute outro.
  const rollSeconds = Math.min(52, Math.max(18, rows * 1.4));

  return (
    <main className={`ou ${outro?.startedAt ? 'ou--rolling' : ''}`}>
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />
      <div className="cd__glow" />
      <section className="ou__thanks">
        <h1 className="ou__title">{text.thanks}</h1>
        <p className="ou__see">{text.see}</p>
        {stats && (
          <div className="ou__stats">
            {stats.messages > 0 && <p>{text.stats(formatNumber(stats.messages, text), formatNumber(stats.chatters, text))}</p>}
            {stats.likes !== null && <p>{text.likeStat(formatNumber(stats.likes, text))}</p>}
          </div>
        )}
        <Tux action={TUX_OUTRO[Math.floor(now / TUX_SLOT_MS) % TUX_OUTRO.length]} />
      </section>
      {groups.length > 0 && (
        <section className="ou__credits">
          <div key={outro?.startedAt ?? 0} className="ou__roll" style={{ animationDuration: `${rollSeconds}s` }}>
            {groups.map((group) => (
              <div key={group.title} className="ou__group">
                <h2 className="ou__group-title">{group.title}</h2>
                {group.rows.map((row) => (
                  <p key={row.name} className="ou__row">
                    <span className="ou__name">{row.name}</span>
                    {row.detail && <span className="ou__detail">{row.detail}</span>}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
