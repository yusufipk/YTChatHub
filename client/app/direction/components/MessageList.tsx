'use client';

import type { JSX } from 'react';
import type { ChatMessage } from '@shared/chat';

const badgeFallbackLabels: Record<string, string> = {
  moderator: 'Moderator',
  member: 'Member',
  verified: 'Verified',
  custom: 'Member'
};

type MessageListProps = {
  messages: ChatMessage[];
  highlightRegex: RegExp | null;
  authorHighlightRegex: RegExp | null;
  onFilterAuthor: (author: string) => void;
  onOverlaySelection: (id: string) => void;
};

export function MessageList({
  messages,
  highlightRegex,
  authorHighlightRegex,
  onFilterAuthor,
  onOverlaySelection
}: MessageListProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className="direction__list">
      {messages.map((message) => (
        <li key={message.id} className="direction__card">
          <header className="direction__card-header">
            <div>
              <div className="direction__card-author">
                {message.authorPhoto && (
                  <img src={message.authorPhoto} alt={message.author} className="direction__author-avatar" />
                )}
                <button
                  type="button"
                  className="direction__viewer-button direction__card-authorName"
                  onClick={() => onFilterAuthor(message.author)}
                  title="Filter messages from this viewer"
                >
                  {renderHighlightedText(message.author, authorHighlightRegex)}
                </button>
                {renderBadges(message)}
              </div>
              <span className="direction__card-meta">{formatMessageMeta(message)}</span>
            </div>
            <div className="direction__card-actions">
              <button
                type="button"
                className="direction__button direction__button--ghost"
                onClick={() => onFilterAuthor(message.author)}
              >
                Filter author
              </button>
              {message.authorChannelUrl && (
                <a
                  href={message.authorChannelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="direction__button direction__button--primary direction__button--link"
                >
                  View this author
                </a>
              )}
              <button
                type="button"
                className="direction__button direction__button--primary"
                onClick={() => onOverlaySelection(message.id)}
              >
                Send to overlay
              </button>
            </div>
          </header>

          <div className="direction__card-body">{renderMessageContent(message, highlightRegex)}</div>
        </li>
      ))}
    </ul>
  );
}

function renderBadges(message: ChatMessage) {
  if (!Array.isArray(message.badges) || message.badges.length === 0) {
    return null;
  }

  return (
    <span className="direction__badge-strip">
      {message.badges.map((badge, index) => {
        const label = badge.label || badgeFallbackLabels[badge.type] || badge.type;
        return (
          <span key={`${badge.type}-${index}`} className={`direction__badge direction__badge--${badge.type}`} title={label}>
            {badge.imageUrl ? <img src={badge.imageUrl} alt={label} /> : label}
          </span>
        );
      })}
    </span>
  );
}

function formatMessageMeta(message: ChatMessage): string {
  const date = new Date(message.publishedAt);
  const type = message.superChat
    ? 'Super Chat'
    : message.membershipGift || message.membershipGiftPurchase
      ? 'Membership'
      : 'Regular';
  return `${type} • ${date.toLocaleString()}`;
}

function renderMessageContent(message: ChatMessage, highlightRegex: RegExp | null) {
  if (message.superChat) {
    return (
      <div className="direction__superchat">
        <div className="direction__superchat-header" style={{ backgroundColor: message.superChat.color }}>
          <span>
            {message.superChat.currency}
            {message.superChat.currency ? ' ' : ''}
            {message.superChat.amount}
          </span>
        </div>
        <div className="direction__message-text">{renderRunsOrText(message, highlightRegex)}</div>
      </div>
    );
  }

  if (message.membershipGift || message.membershipGiftPurchase) {
    return (
      <div className="direction__membership">
        {message.membershipGiftPurchase && message.giftCount ? (
          <p>
            {message.author} gifted {message.giftCount} membership{message.giftCount > 1 ? 's' : ''}
          </p>
        ) : (
          <p>{message.membershipLevel ?? 'Membership Event'}</p>
        )}
        <div className="direction__message-text">{renderRunsOrText(message, highlightRegex)}</div>
      </div>
    );
  }

  return <div className="direction__message-text">{renderRunsOrText(message, highlightRegex)}</div>;
}

function renderRunsOrText(message: ChatMessage, highlightRegex: RegExp | null) {
  if (Array.isArray(message.runs) && message.runs.length > 0) {
    return message.runs.map((run, index) => {
      if (run.emojiUrl) {
        return <img key={`emoji-${index}`} src={run.emojiUrl} alt={run.emojiAlt ?? 'emoji'} className="direction__emoji" />;
      }
      if (!run.text) {
        return null;
      }
      return <span key={`text-${index}`}>{renderHighlightedText(run.text, highlightRegex)}</span>;
    });
  }

  return renderHighlightedText(message.text ?? '', highlightRegex);
}

function renderHighlightedText(text: string, highlightRegex: RegExp | null) {
  if (!text) {
    return null;
  }
  if (!highlightRegex) {
    return text;
  }

  const globalRegex = new RegExp(
    highlightRegex.source,
    highlightRegex.flags.includes('g') ? highlightRegex.flags : `${highlightRegex.flags}g`
  );
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let guard = 0;

  while ((match = globalRegex.exec(text)) !== null && guard < 1000) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    if (end > start) {
      nodes.push(
        <strong key={`hl-${start}-${end}`} className="direction__highlight">
          {text.slice(start, end)}
        </strong>
      );
    }
    lastIndex = end;
    if (match[0].length === 0) {
      globalRegex.lastIndex += 1;
    }
    guard += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
}
