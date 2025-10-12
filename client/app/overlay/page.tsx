'use client';

import { useEffect, useState, useRef } from 'react';
import type { ChatMessage } from '@shared/chat';
import { proxyImageUrl } from '../../lib/imageProxy';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';

type SelectionPayload = {
  message: ChatMessage | null;
};

export default function OverlayPage() {
  const [message, setMessage] = useState<ChatMessage | null>(null);
  const [displayMessage, setDisplayMessage] = useState<ChatMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const connectionRef = useRef<EventSource | null>(null);
  const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      console.log('[Overlay] Closing SSE connection');
      source.removeEventListener('selection', onSelection as EventListener);
      source.close();
      connectionRef.current = null;
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only connect once

  // Handle message transitions
  useEffect(() => {
    // Clear any pending timeout
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }

    if (message === null && displayMessage !== null) {
      // Deselecting - fade out
      setFadingOut(true);
      setSwitching(false);
      switchTimeoutRef.current = setTimeout(() => {
        setDisplayMessage(null);
        setFadingOut(false);
      }, 300);
    } else if (message !== null && displayMessage !== null && message.id !== displayMessage.id) {
      // Switching between messages - fade out then fade in
      setSwitching(true);
      setFadingOut(true);
      switchTimeoutRef.current = setTimeout(() => {
        setDisplayMessage(message);
        setFadingOut(false);
        setSwitching(false);
      }, 300);
    } else if (message !== null && displayMessage === null) {
      // First message - just show it
      setDisplayMessage(message);
      setFadingOut(false);
      setSwitching(false);
    }
  }, [message, displayMessage]);

  return (
    <main className="overlay">
      {displayMessage ? (
        <div className={`overlay__card ${fadingOut ? 'overlay__card--fadeOut' : ''}`}>
          {displayMessage.superChat ? (
            <>
              <div className="overlay__superchat-header" style={{ backgroundColor: displayMessage.superChat.color }}>
                {displayMessage.authorPhoto && (
                  <img src={proxyImageUrl(displayMessage.authorPhoto)} alt={displayMessage.author} className="overlay__superchat-avatar" />
                )}
                <span className="overlay__superchat-name">{displayMessage.author}</span>
                <span className="overlay__superchat-separator"> - </span>
                <span className="overlay__superchat-amount">
                  {displayMessage.superChat.currency}{displayMessage.superChat.currency ? ' ' : ''}{displayMessage.superChat.amount}
                </span>
              </div>
              {displayMessage.runs?.length ? (
                <p className="overlay__superchat-text">
                  {displayMessage.runs.map((r, i) =>
                    r.emojiUrl ? (
                      <img key={i} src={proxyImageUrl(r.emojiUrl)} alt={r.emojiAlt || 'emoji'} className="overlay__emoji" />
                    ) : (
                      <span key={i}>{r.text}</span>
                    )
                  )}
                </p>
              ) : displayMessage.text && displayMessage.text !== 'N/A' && (
                <p className="overlay__superchat-text">{displayMessage.text}</p>
              )}
              {displayMessage.superChat.stickerUrl && (
                <div className="overlay__sticker">
                  <img 
                    src={proxyImageUrl(displayMessage.superChat.stickerUrl)} 
                    alt={displayMessage.superChat.stickerAlt || 'Super Sticker'} 
                    className="overlay__stickerImage"
                    onError={(e) => {
                      // Hide image on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </>
          ) : (displayMessage.membershipGift || displayMessage.membershipGiftPurchase) ? (
            <>
              <div className="overlay__membership-header">
                {displayMessage.authorPhoto && (
                  <img src={proxyImageUrl(displayMessage.authorPhoto)} alt={displayMessage.author} className="overlay__membership-avatar" />
                )}
                <div className="overlay__membership-info">
                  <span className="overlay__membership-name">{displayMessage.author}</span>
                  <span className="overlay__membership-separator"> - </span>
                  <span className="overlay__membership-level">
                    {displayMessage.membershipGiftPurchase && displayMessage.giftCount
                      ? `Sent ${displayMessage.giftCount} Gift Membership${displayMessage.giftCount > 1 ? 's' : ''}`
                      : displayMessage.membershipLevel || 'New Member'}
                  </span>
                </div>
              </div>
              {displayMessage.runs?.length ? (
                <p className="overlay__membership-text">
                  {displayMessage.runs.map((r, i) =>
                    r.emojiUrl ? (
                      <img key={i} src={proxyImageUrl(r.emojiUrl)} alt={r.emojiAlt || 'emoji'} className="overlay__emoji" />
                    ) : (
                      <span key={i}>{r.text}</span>
                    )
                  )}
                </p>
              ) : displayMessage.text && displayMessage.text !== 'N/A' && (
                <p className="overlay__membership-text">{displayMessage.text}</p>
              )}
            </>
          ) : (
            <>
              <div className="overlay__header">
                {displayMessage.authorPhoto && (
                  <img src={proxyImageUrl(displayMessage.authorPhoto)} alt={displayMessage.author} className="overlay__avatar" />
                )}
                <div>
                  <div className="overlay__authorLine">
                    <span className="overlay__author">{displayMessage.author}</span>
                    {displayMessage.leaderboardRank && (
                      <span className="overlay__badge overlay__badge--leaderboard" title={`#${displayMessage.leaderboardRank} on leaderboard`}>
                        👑 #{displayMessage.leaderboardRank}
                      </span>
                    )}
                    {displayMessage.badges && displayMessage.badges.map((badge, i) => (
                      badge.imageUrl ? (
                        <img key={i} src={proxyImageUrl(badge.imageUrl)} alt={badge.label} className="overlay__badge overlay__badge--image" title={badge.label} />
                      ) : (
                        <span key={i} className={`overlay__badge overlay__badge--${badge.type}`} title={badge.label}>
                          {badge.type === 'moderator' && '🛡️'}
                          {badge.type === 'member' && '⭐'}
                          {badge.type === 'verified' && '✓'}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              </div>
              {displayMessage.runs?.length ? (
                <p className="overlay__text">
                  {displayMessage.runs.map((r, i) =>
                    r.emojiUrl ? (
                      <img key={i} src={proxyImageUrl(r.emojiUrl)} alt={r.emojiAlt || 'emoji'} className="overlay__emoji" />
                    ) : (
                      <span key={i}>{r.text}</span>
                    )
                  )}
                </p>
              ) : displayMessage.text && displayMessage.text !== 'N/A' && (
                <p className="overlay__text">{displayMessage.text}</p>
              )}
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
