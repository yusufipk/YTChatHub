export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;

export type TextPart = { type: 'text' | 'link'; content: string };

/** Splits plain text into text and link parts. Used only for runs YouTube did not mark as links. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', content: text.slice(last, index) });
    parts.push({ type: 'link', content: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
  return parts;
}

export function formatAmount(amount: string, currency: string): string {
  return currency ? `${currency} ${amount}` : amount;
}
