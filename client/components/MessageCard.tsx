'use client';

import { Gift } from 'lucide-react';
import type { ChatMessage } from '@shared/chat';
import { proxyImageUrl } from '../lib/imageProxy';
import { GIFT_ACCENT, formatAmount, formatTime } from '../lib/format';
import { giftLabel, membershipLabel, useStrings } from '../lib/i18n';
import { Badges } from './Badges';
import { MessageBody } from './MessageBody';

type Props = {
  message: ChatMessage;
  selected: boolean;
  wasSelected: boolean;
  onSelect: (message: ChatMessage) => void;
  onLink: (url: string) => void;
};

export function MessageCard({ message, selected, wasSelected, onSelect, onLink }: Props) {
  const t = useStrings();
  const kind = message.superChat || message.gift ? 'super' : message.membershipGift || message.membershipGiftPurchase ? 'member' : 'chat';
  const className = ['card', `card--${kind}`, selected && 'card--selected', wasSelected && 'card--seen'].filter(Boolean).join(' ');
  const accent = message.superChat?.color ?? (message.gift ? GIFT_ACCENT : undefined);

  return (
    <button type="button" className={className} onClick={() => onSelect(message)} style={accent ? { ['--accent' as string]: accent } : undefined}>
      <div className="card__head">
        {message.authorPhoto ? (
          <img src={proxyImageUrl(message.authorPhoto)} alt="" className="avatar" loading="lazy" />
        ) : (
          <span className="avatar avatar--empty">{message.author.slice(0, 1)}</span>
        )}
        <span className="card__author">{message.author}</span>
        <Badges message={message} />
        {message.superChat && <span className="card__amount">{formatAmount(message.superChat.amount, message.superChat.currency)}</span>}
        {message.gift && <span className="card__amount">{giftLabel(message.gift, t)}</span>}
        {kind === 'member' && (
          <span className="card__level">
            <Gift size={11} strokeWidth={2.5} />
            {membershipLabel(message, t)}
          </span>
        )}
        <time className="card__time">{formatTime(message.publishedAt, t.locale)}</time>
      </div>
      <MessageBody message={message} className="card__text" onLink={onLink} />
      {message.gift?.imageUrl && <img src={message.gift.imageUrl} alt={message.gift.name} className="gift" onError={(event) => { event.currentTarget.hidden = true; }} />}
      {message.superChat?.stickerUrl && (
        <img
          src={proxyImageUrl(message.superChat.stickerUrl)}
          alt={message.superChat.stickerAlt || 'Super Sticker'}
          className="sticker"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </button>
  );
}
