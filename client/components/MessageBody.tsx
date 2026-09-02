'use client';

import type { ChatMessage, MessageRun } from '@shared/chat';
import { proxyImageUrl } from '../lib/imageProxy';
import { splitLinks } from '../lib/format';

type Props = {
  message: ChatMessage;
  className?: string;
  /** When given, links are clickable and call this instead of navigating. When omitted links render as text. */
  onLink?: (url: string) => void;
};

function runsOf(message: ChatMessage): MessageRun[] {
  if (message.runs?.length) return message.runs;
  if (message.text && message.text !== 'N/A') return [{ text: message.text }];
  return [];
}

export function MessageBody({ message, className, onLink }: Props) {
  const runs = runsOf(message);
  if (!runs.length) return null;

  const link = (url: string, label: string, key: number) =>
    onLink ? (
      <a
        key={key}
        href={url}
        className="link"
        title={url}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onLink(url);
        }}
      >
        {label}
      </a>
    ) : (
      <span key={key} className="link">{label}</span>
    );

  return (
    <p className={className}>
      {runs.map((run, i) => {
        if (run.emojiUrl) {
          return <img key={i} src={proxyImageUrl(run.emojiUrl)} alt={run.emojiAlt || 'emoji'} className="emoji" loading="lazy" />;
        }
        if (run.url) return link(run.url, run.text || run.url, i);
        return splitLinks(run.text ?? '').map((part, j) =>
          part.type === 'link' ? link(part.content, part.content, i * 1000 + j) : <span key={i * 1000 + j}>{part.content}</span>
        );
      })}
    </p>
  );
}
