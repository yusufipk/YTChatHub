'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@shared/chat';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';

type SelectionPayload = {
  message: ChatMessage | null;
};

export default function OverlayPage() {
  const [message, setMessage] = useState<ChatMessage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`${BACKEND_URL}/overlay/stream`);
    const onSelection = (event: MessageEvent) => {
      try {
        const payload: SelectionPayload = JSON.parse(event.data);
        setMessage(payload.message);
        setConnected(true);
      } catch (error) {
        console.error('overlay: failed to parse payload', error);
      }
    };

    source.addEventListener('selection', onSelection as EventListener);
    source.addEventListener('heartbeat', () => setConnected(true));
    source.onerror = () => setConnected(false);

    return () => {
      source.removeEventListener('selection', onSelection as EventListener);
      source.close();
    };
  }, []);

  return (
    <main className="overlay">
      {message ? (
        <div className="overlay__card">
          <span className="overlay__author">{message.author}</span>
          <p className="overlay__text">{message.text}</p>
        </div>
      ) : (
        <div className="overlay__placeholder">
          <span>{connected ? 'Awaiting selection…' : 'Reconnecting…'}</span>
        </div>
      )}
    </main>
  );
}
