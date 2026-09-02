'use client';

import { X } from 'lucide-react';
import type { ChatMessage } from '@shared/chat';
import { proxyImageUrl } from '../lib/imageProxy';
import { formatAmount } from '../lib/format';
import { MessageBody } from './MessageBody';

type Props = { selection: ChatMessage | null; onClear: () => void };

/** Mirrors what the OBS overlay is showing right now, so the operator never has to guess. */
export function OnAir({ selection, onClear }: Props) {
  return (
    <section className={`onair ${selection ? 'onair--live' : ''}`}>
      <span className="onair__label">On air</span>
      {selection ? (
        <>
          {selection.authorPhoto && <img src={proxyImageUrl(selection.authorPhoto)} alt="" className="avatar avatar--sm" />}
          <span className="onair__author">{selection.author}</span>
          {selection.superChat && (
            <span className="card__amount" style={{ background: selection.superChat.color }}>
              {formatAmount(selection.superChat.amount, selection.superChat.currency)}
            </span>
          )}
          <MessageBody message={selection} className="onair__text" />
          <button type="button" className="btn btn--sm" onClick={onClear} title="Clear the overlay (Esc)">
            <X size={13} />
            Clear
          </button>
        </>
      ) : (
        <span className="onair__hint">Nothing on the overlay. Click a message to show it, click again to hide it.</span>
      )}
    </section>
  );
}
