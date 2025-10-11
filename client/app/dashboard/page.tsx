'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { ChatMessage } from '@shared/chat';

// URL regex for detecting links (http/https)
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function parseTextWithLinks(text: string): Array<{ type: 'text' | 'link'; content: string }> {
  const parts: Array<{ type: 'text' | 'link'; content: string }> = [];
  let lastIndex = 0;
  const matches = text.matchAll(URL_REGEX);
  
  for (const match of matches) {
    const url = match[0];
    const index = match.index!;
    
    // Add text before the URL
    if (index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, index) });
    }
    
    // Add the URL
    parts.push({ type: 'link', content: url });
    lastIndex = index + url.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';
const POLL_INTERVAL = 2500;

// Global singleton to prevent multiple SSE connections across all renders/remounts
let globalSSEConnection: EventSource | null = null;
let globalConnectionListeners: Set<(payload: any) => void> = new Set();

export default function DashboardPage() {
  const { messages, refresh, error: pollError } = useChatMessages();
  const { selection, status: overlayStatus } = useOverlaySelection();
  const { connected, liveId, connect, disconnect, connecting } = useConnection();
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (message: ChatMessage) => {
      try {
        // If clicking the already-selected message, clear it
        if (selection?.id === message.id) {
          await fetch(`${BACKEND_URL}/overlay/selection`, { method: 'DELETE' });
        } else {
          // Otherwise, select the new message
          await fetch(`${BACKEND_URL}/overlay/selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: message.id })
          });
        }
      } catch (error) {
        console.error('Failed to select message', error);
      }
    },
    [selection]
  );

  const handleClear = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/overlay/selection`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear selection', error);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [refresh]);

  const statusHint = useMemo(() => {
    if (pollError) return 'Backend unreachable';
    if (overlayStatus === 'connecting') return 'Connecting to overlay…';
    if (overlayStatus === 'error') return 'Overlay stream disconnected';
    return 'Live';
  }, [pollError, overlayStatus]);

  const handleLinkClick = useCallback((url: string) => {
    setConfirmUrl(url);
  }, []);

  const handleConfirmOpen = useCallback(() => {
    if (confirmUrl) {
      window.open(confirmUrl, '_blank', 'noopener,noreferrer');
      setConfirmUrl(null);
    }
  }, [confirmUrl]);

  const handleCancelOpen = useCallback(() => {
    setConfirmUrl(null);
  }, []);

  const superChats = useMemo(() => messages.filter(m => m.superChat), [messages]);
  const newMembers = useMemo(() => messages.filter(m => m.membershipGift || m.membershipGiftPurchase), [messages]);
  const regularMessages = useMemo(() => messages.filter(m => !m.superChat && !m.membershipGift && !m.membershipGiftPurchase), [messages]);

  return (
    <main className="dashboard">
      {!connected && (
        <div className="connectionPrompt">
          <div className="connectionPrompt__content">
            <h2>Connect to YouTube Live Stream</h2>
            <form className="connectionPrompt__form" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const liveId = formData.get('liveId') as string;
              if (liveId.trim()) {
                connect(liveId.trim());
              }
            }}>
              <input
                name="liveId"
                type="text"
                placeholder="Enter YouTube Live Stream ID or URL"
                disabled={connecting}
                autoFocus
              />
              <button type="submit" disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        </div>
      )}

      {connected && (
        <>
          <header className="dashboard__tabs">
            <div className="tab">
              Messages <span className="tab__count">{regularMessages.length}</span>
            </div>
            <div className="tab">
              Superchats <span className="tab__count">{superChats.length}</span>
            </div>
            <div className="tab">
              Members <span className="tab__count">{newMembers.length}</span>
            </div>
            <button className="btn-reset" onClick={disconnect} title="Reset stream connection">
              🔄
            </button>
          </header>

          <section className="dashboard__grid">
            <div className="panel panel--chat">
              <div className="panel__header">
                <h2>💬 CHAT MESSAGES</h2>
                <button 
                  className="btn-clear-inline" 
                  onClick={handleClear}
                  disabled={!selection}
                >
                  CLEAR
                </button>
              </div>
              <ChatListPanel
                messages={regularMessages}
                renderItem={(message) => (
                  <ChatItem
                    key={message.id}
                    message={message}
                    isSelected={selection?.id === message.id}
                    onSelect={() => handleSelect(message)}
                    onLinkClick={handleLinkClick}
                  />
                )}
                emptyState={
                  <div className="chatList__empty">
                    <p>⏳ Waiting for chat messages...</p>
                  </div>
                }
              />
            </div>

            <div className="dashboard__grid-right">
              <div className="panel panel--super">
                <div className="panel__header">
                  <h2>🔥 SUPER CHATS</h2>
                </div>
                <ChatListPanel
                  messages={superChats}
                  renderItem={(message) => (
                    <ChatItem
                      key={message.id}
                      message={message}
                      isSelected={selection?.id === message.id}
                      onSelect={() => handleSelect(message)}
                      onLinkClick={handleLinkClick}
                    />
                  )}
                  emptyState={
                    <div className="chatList__empty">
                      <p>No super chats yet</p>
                    </div>
                  }
                />
              </div>

              <div className="panel panel--members">
                <div className="panel__header">
                  <h2>⭐ MEMBERSHIPS & MILESTONES</h2>
                </div>
                <ChatListPanel
                  messages={newMembers}
                  renderItem={(message) => (
                    <MemberItem
                      key={message.id}
                      message={message}
                      isSelected={selection?.id === message.id}
                      onSelect={() => handleSelect(message)}
                      onLinkClick={handleLinkClick}
                    />
                  )}
                  emptyState={
                    <div className="chatList__empty">
                      <p>No new members yet</p>
                    </div>
                  }
                />
              </div>
            </div>
          </section>
        </>
      )}

      {confirmUrl && (
        <div className="modal-overlay" onClick={handleCancelOpen}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Open External Link?</h3>
            <p className="modal__url">{confirmUrl}</p>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--cancel" onClick={handleCancelOpen}>
                Cancel
              </button>
              <button className="modal__btn modal__btn--confirm" onClick={handleConfirmOpen}>
                Open Link
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/chat/messages`);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { messages, refresh, error };
}

type OverlayStatus = 'connecting' | 'live' | 'error';

type SelectionPayload = {
  message: ChatMessage | null;
};

function useOverlaySelection() {
  const [selection, setSelection] = useState<ChatMessage | null>(null);
  const [status, setStatus] = useState<OverlayStatus>('connecting');
  const listenerRef = useRef<((payload: any) => void) | null>(null);

  useEffect(() => {
    // Create global connection if it doesn't exist
    if (!globalSSEConnection) {
      console.log('[Dashboard] Creating GLOBAL SSE connection');
      globalSSEConnection = new EventSource(`${BACKEND_URL}/overlay/stream`);
      
      globalSSEConnection.addEventListener('selection', ((event: MessageEvent) => {
        try {
          const payload: SelectionPayload = JSON.parse(event.data);
          // Broadcast to all listeners
          globalConnectionListeners.forEach(listener => listener(payload));
        } catch (error) {
          console.error('Failed to parse selection payload', error);
        }
      }) as EventListener);

      globalSSEConnection.addEventListener('heartbeat', () => {
        // Heartbeat - connection is alive
      });

      globalSSEConnection.onerror = (error) => {
        console.error('[Dashboard] SSE connection error - will auto-reconnect', error);
        // EventSource automatically reconnects, no action needed
      };
    }

    // Register this component's listener
    const myListener = (payload: SelectionPayload) => {
      setSelection(payload.message);
      setStatus('live');
    };
    
    listenerRef.current = myListener;
    globalConnectionListeners.add(myListener);

    return () => {
      // Unregister this component's listener
      if (listenerRef.current) {
        globalConnectionListeners.delete(listenerRef.current);
      }
      // Don't close global connection - other components might use it
    };
  }, []);

  return { selection, status };
}

function useConnection() {
  const [connected, setConnected] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      setConnected(data.connected);
      setLiveId(data.liveId);
    } catch (error) {
      console.error('Failed to check connection status', error);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const connect = useCallback(async (liveId: string) => {
    setConnecting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/chat/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect');
      }
      
      await checkStatus();
    } catch (error) {
      console.error('Failed to connect', error);
      alert('Failed to connect to YouTube Live chat. Please check the Live ID.');
    } finally {
      setConnecting(false);
    }
  }, [checkStatus]);

  const disconnect = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/chat/disconnect`, { method: 'POST' });
      await checkStatus();
    } catch (error) {
      console.error('Failed to disconnect', error);
    }
  }, [checkStatus]);

  return { connected, liveId, connect, disconnect, connecting };
}

type ConnectionControlProps = {
  connected: boolean;
  liveId: string | null;
  connecting: boolean;
  onConnect: (liveId: string) => void;
  onDisconnect: () => void;
  inline?: boolean;
};

function ConnectionControl({ connected, liveId, connecting, onConnect, onDisconnect, inline }: ConnectionControlProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onConnect(inputValue.trim());
    }
  };

  return (
    <div className={"connectionControl" + (inline ? " connectionControl--inline" : "") }>
      <div className="connectionControl__content">
        {connected ? (
          <div className="connectionControl__connected">
            <div className="connectionControl__info">
              <span className="connectionControl__badge">🟢 Connected</span>
              <span className="connectionControl__liveId">Live ID: {liveId}</span>
            </div>
            <button className="btn-disconnect" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <form className="connectionControl__form" onSubmit={handleSubmit}>
            <div className="connectionControl__input">
              <label htmlFor="liveId">YouTube Live Stream ID or URL</label>
              <input
                id="liveId"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g., dQw4w9WgXcQ or https://youtube.com/watch?v=..."
                disabled={connecting}
              />
            </div>
            <button
              type="submit"
              className="btn-connect"
              disabled={connecting || !inputValue.trim()}
            >
              {connecting ? 'Connecting...' : 'Connect to Stream'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

type ChatItemProps = {
  message: ChatMessage;
  isSelected: boolean;
  onSelect: () => void;
  onLinkClick: (url: string) => void;
};

function MessageText({ text, onLinkClick }: { text: string; onLinkClick: (url: string) => void }) {
  const parts = parseTextWithLinks(text);
  return (
    <>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href="#"
            className="message-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLinkClick(part.content);
            }}
          >
            {part.content}
          </a>
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </>
  );
}

type ChatListPanelProps = {
  messages: ChatMessage[];
  renderItem: (message: ChatMessage) => React.ReactNode;
  emptyState: React.ReactNode;
};

function ChatListPanel({ messages, renderItem, emptyState }: ChatListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const handleScroll = () => {
      const isAtBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= 150;
      wasAtBottomRef.current = isAtBottom;
    };

    node.addEventListener('scroll', handleScroll);
    return () => node.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node && wasAtBottomRef.current) {
      // Use setTimeout with requestAnimationFrame for more reliable scrolling
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (node && wasAtBottomRef.current) {
            node.scrollTop = node.scrollHeight;
          }
        });
      }, 0);
    }
  }, [messages]);

  return (
    <div className="chatList" ref={scrollRef}>
      {messages.length > 0 ? messages.map(renderItem) : emptyState}
    </div>
  );
}

function ChatItem({ message, isSelected, onSelect, onLinkClick }: ChatItemProps) {
  return (
    <button
      className={isSelected ? 'chatItem chatItem--active' : 'chatItem'}
      onClick={onSelect}
    >
      <div className="chatItem__header">
        {message.authorPhoto && (
          <img src={message.authorPhoto} alt={message.author} className="chatItem__avatar" />
        )}
        <div className="chatItem__meta">
          <div className="chatItem__authorLine">
            {message.membershipLevel && (
              <span className="chatItem__membership">{message.membershipLevel}:</span>
            )}
            <span className="chatItem__author">{message.author}</span>
            {message.badges && message.badges.map((badge, i) => (
              badge.imageUrl ? (
                <img key={i} src={badge.imageUrl} alt={badge.label} className="badge badge--image" title={badge.label} />
              ) : (
                <span key={i} className={`badge badge--${badge.type}`} title={badge.label}>
                  {badge.type === 'moderator' && '🛡️'}
                  {badge.type === 'member' && '⭐'}
                  {badge.type === 'verified' && '✓'}
                </span>
              )
            ))}
            {message.superChat && (
              <span className="chatItem__superchat-inline" style={{ backgroundColor: message.superChat.color }}>
                {message.superChat.currency}{message.superChat.currency ? ' ' : ''}{message.superChat.amount}
              </span>
            )}
          </div>
          <time className="chatItem__time">{new Date(message.publishedAt).toLocaleTimeString()}</time>
        </div>
      </div>
      {message.runs?.length ? (
        <p className="chatItem__text">
          {message.runs.map((r, i) =>
            r.emojiUrl ? (
              <img key={i} src={r.emojiUrl} alt={r.emojiAlt || 'emoji'} className="chatItem__emoji" />
            ) : (
              <span key={i}><MessageText text={r.text || ''} onLinkClick={onLinkClick} /></span>
            )
          )}
        </p>
      ) : message.text && (
        <p className="chatItem__text">
          <MessageText text={message.text} onLinkClick={onLinkClick} />
        </p>
      )}
    </button>
  );
}

function MemberItem({ message, isSelected, onSelect, onLinkClick }: ChatItemProps) {
  return (
    <button
      className={isSelected ? 'memberItem memberItem--active' : 'memberItem'}
      onClick={onSelect}
    >
      <div className="memberItem__header">
        {message.authorPhoto && (
          <img src={message.authorPhoto} alt={message.author} className="memberItem__avatar" />
        )}
        <div className="memberItem__info">
          <span className="memberItem__author">{message.author}</span>
          <span className="memberItem__level">
            {message.membershipGiftPurchase && message.giftCount 
              ? `Sent ${message.giftCount} gift membership${message.giftCount > 1 ? 's' : ''}`
              : message.membershipLevel || 'New member'}
          </span>
          <time className="memberItem__time">{new Date(message.publishedAt).toLocaleTimeString()}</time>
        </div>
      </div>
      {message.runs?.length ? (
        <p className="memberItem__text">
          {message.runs.map((r, i) =>
            r.emojiUrl ? (
              <img key={i} src={r.emojiUrl} alt={r.emojiAlt || 'emoji'} className="memberItem__emoji" />
            ) : (
              <span key={i}><MessageText text={r.text || ''} onLinkClick={onLinkClick} /></span>
            )
          )}
        </p>
      ) : message.text && (
        <p className="memberItem__text">
          <MessageText text={message.text} onLinkClick={onLinkClick} />
        </p>
      )}
    </button>
  );
}
