'use client';

import { X } from 'lucide-react';
import type { ChatMessage } from '@shared/chat';
import { proxyImageUrl } from '../lib/imageProxy';
import { GIFT_ACCENT, formatAmount } from '../lib/format';
import { giftLabel, useStrings } from '../lib/i18n';
import { MessageBody } from './MessageBody';

type Props = { selection: ChatMessage | null; onClear: () => void };

/** Mirrors what the OBS overlay is showing right now, so the operator never has to guess. */
export function OnAir({ selection, onClear }: Props) {
  const t = useStrings();
  return (
    <section className={`onair ${selection ? 'onair--live' : ''}`}>
      <span className="onair__label">{t.onAir}</span>
      {selection ? (
        <>
          {selection.authorPhoto && <img src={proxyImageUrl(selection.authorPhoto)} alt="" className="avatar avatar--sm" />}
          <span className="onair__author">{selection.author}</span>
          {selection.superChat && (
            <span className="card__amount" style={{ background: selection.superChat.color }}>
              {formatAmount(selection.superChat.amount, selection.superChat.currency)}
            </span>
          )}
          {selection.gift && (
            <span className="card__amount" style={{ background: GIFT_ACCENT }}>
              {giftLabel(selection.gift, t)}
            </span>
          )}
          <MessageBody message={selection} className="onair__text" />
          <button type="button" className="btn btn--sm" onClick={onClear} title={t.clearTitle}>
            <X size={13} />
            {t.clear}
          </button>
        </>
      ) : (
        <span className="onair__hint">{t.onAirHint}</span>
      )}
    </section>
  );
}
