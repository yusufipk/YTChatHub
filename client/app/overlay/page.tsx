'use client';

import { useEffect, useState, useRef } from 'react';
import type { ChatMessage } from '@shared/chat';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';

type SelectionPayload = {
  message: ChatMessage | null;
};

export default function OverlayPage() {
  const [message, setMessage] = useState<ChatMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const connectionRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Prevent multiple connections
    if (connectionRef.current) {
      console.log('[Overlay] SSE already connected');
      return;
    }

    console.log('[Overlay] Creating SSE connection');
    const source = new EventSource(`${BACKEND_URL}/overlay/stream`);
    connectionRef.current = source;
    
    const onSelection = (event: MessageEvent) => {
      try {
        const payload: SelectionPayload = JSON.parse(event.data);
        
        setMessage((prevMessage) => {
          if (payload.message === null && prevMessage !== null) {
            // Trigger fade out animation before clearing
            setFadingOut(true);
            setTimeout(() => {
              setMessage(null);
              setFadingOut(false);
            }, 300);
            return prevMessage; // Keep current message during fade
          } else {
            setFadingOut(false);
            return payload.message;
          }
        });
        
        setConnected(true);
      } catch (error) {
        console.error('overlay: failed to parse payload', error);
      }
    };

    source.addEventListener('selection', onSelection as EventListener);
    source.addEventListener('heartbeat', () => setConnected(true));
    source.onerror = () => setConnected(false);

    return () => {
      console.log('[Overlay] Closing SSE connection');
      source.removeEventListener('selection', onSelection as EventListener);
      source.close();
      connectionRef.current = null;
    };
  }, []); // Empty dependency array - only connect once

  return (
    <main className="overlay">
      {message ? (
        <div className={`overlay__card ${fadingOut ? 'overlay__card--fadeOut' : ''}`}>
          <div className="overlay__header">
            {message.authorPhoto && (
              <img src={message.authorPhoto} alt={message.author} className="overlay__avatar" />
            )}
            <div>
              <div className="overlay__authorLine">
                <span className="overlay__author">{message.author}</span>
                {message.badges && message.badges.map((badge, i) => (
                  <span key={i} className={`overlay__badge overlay__badge--${badge.type}`} title={badge.label}>
                    {badge.type === 'moderator' && '🛡️'}
                    {badge.type === 'member' && '⭐'}
                    {badge.type === 'verified' && '✓'}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {message.superChat && (
            <div className="overlay__superchat" style={{ backgroundColor: message.superChat.color }}>
              💰 {message.superChat.amount}
            </div>
          )}
          {message.membershipGift && (
            <div className="overlay__membership">
              🎁 New Member!
            </div>
          )}
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
