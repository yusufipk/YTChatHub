'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@shared/chat';
import { Badges } from '../../components/Badges';
import { MessageBody } from '../../components/MessageBody';
import { formatAmount } from '../../lib/format';
import { proxyImageUrl } from '../../lib/imageProxy';
import { DEFAULT_OPTIONS, parseOverlayOptions, type OverlayOptions } from '../../lib/overlayOptions';
import { useEvents } from '../../lib/useEvents';

const SWAP_MS = 220;

function membershipLabel(message: ChatMessage): string {
  if (message.membershipGiftPurchase && message.giftCount) {
    return `Gifted ${message.giftCount} membership${message.giftCount > 1 ? 's' : ''}`;
  }
  return message.membershipLevel || 'New member';
}

export default function OverlayPage() {
  const { selection } = useEvents();
  const [options, setOptions] = useState<OverlayOptions>(DEFAULT_OPTIONS);
  const [shown, setShown] = useState<ChatMessage | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setOptions(parseOverlayOptions(window.location.search));
    document.body.classList.add('is-overlay');
    return () => document.body.classList.remove('is-overlay');
  }, []);

  // Swap with a short exit animation so a new pick never pops in over the old one.
  useEffect(() => {
    if ((selection?.id ?? null) === (shown?.id ?? null)) return;
    if (!shown || options.anim === 'none') {
      setShown(selection);
      setExpired(false);
      return;
    }
    setLeaving(true);
    const timer = setTimeout(() => {
      setShown(selection);
      setExpired(false);
      setLeaving(false);
    }, SWAP_MS);
    return () => clearTimeout(timer);
  }, [selection, shown, options.anim]);

  useEffect(() => {
    if (!options.hide || !shown) return;
    const timer = setTimeout(() => setExpired(true), options.hide * 1000);
    return () => clearTimeout(timer);
  }, [shown, options.hide]);

  const message = expired ? null : shown;
  const kind = message?.superChat ? 'super' : message?.membershipGift || message?.membershipGiftPurchase ? 'member' : 'chat';

  return (
    <main className={`ov ov--${options.theme} ov--${options.pos} ov--size-${options.size} ov--anim-${options.anim}`} style={{ ['--w' as string]: String(options.width) }}>
      {message && (
        <div key={message.id} className={`ov__card ov__card--${kind} ${leaving ? 'ov__card--leaving' : ''}`} style={message.superChat ? { ['--accent' as string]: message.superChat.color } : undefined}>
          <div className="ov__head">
            {message.authorPhoto && <img src={proxyImageUrl(message.authorPhoto)} alt="" className="ov__avatar" />}
            <span className="ov__author">{message.author}</span>
            <Badges message={message} />
            {message.superChat && <span className="ov__amount">{formatAmount(message.superChat.amount, message.superChat.currency)}</span>}
            {kind === 'member' && <span className="ov__level">{membershipLabel(message)}</span>}
          </div>
          <MessageBody message={message} className="ov__text" />
          {message.superChat?.stickerUrl && (
            <img
              src={proxyImageUrl(message.superChat.stickerUrl)}
              alt={message.superChat.stickerAlt || 'Super Sticker'}
              className="ov__sticker"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}
