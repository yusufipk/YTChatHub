'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { ChatMessage } from '@shared/chat';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';
const POLL_INTERVAL = 2500;

// Global singleton to prevent multiple SSE connections across all renders/remounts
let globalSSEConnection: EventSource | null = null;
let globalConnectionListeners: Set<(payload: any) => void> = new Set();

export default function DashboardPage() {
  const { messages, refresh, error: pollError } = useChatMessages();
  const { selection, status: overlayStatus } = useOverlaySelection();
  const { connected, liveId, connect, disconnect, connecting } = useConnection();

  const handleSelect = useCallback(
    async (message: ChatMessage) => {
      try {
        await fetch(`${BACKEND_URL}/overlay/selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: message.id })
        });
      } catch (error) {
        console.error('Failed to select message', error);
      }
    },
    []
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

  const superChats = useMemo(() => messages.filter(m => m.superChat), [messages]);
  const newMembers = useMemo(() => messages.filter(m => m.membershipGiftPurchase), [messages]);
  const regularMessages = useMemo(() => messages.filter(m => !m.superChat && !m.membershipGift), [messages]);

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
          </header>

          <section className="dashboard__grid">
            <div className="panel panel--chat">
              <div className="panel__header">
                <h2>💬 CHAT MESSAGES</h2>
              </div>
              <ChatListPanel
                messages={regularMessages}
                renderItem={(message) => (
                  <ChatItem
                    key={message.id}
                    message={message}
                    isSelected={selection?.id === message.id}
                    onSelect={() => handleSelect(message)}
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

          {selection && (
            <button className="btn-clear-fixed" onClick={handleClear}>
              CLEAR
            </button>
          )}
        </>
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

      globalSSEConnection.onerror = () => {
        console.error('[Dashboard] SSE error');
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
};

type ChatListPanelProps = {
  messages: ChatMessage[];
  renderItem: (message: ChatMessage) => React.ReactNode;
  emptyState: React.ReactNode;
};

function ChatListPanel({ messages, renderItem, emptyState }: ChatListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      // Check if user is near the bottom before scrolling
      const isAtBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= 100;
      if (isAtBottom) {
        node.scrollTop = node.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="chatList" ref={scrollRef}>
      {messages.length > 0 ? messages.map(renderItem) : emptyState}
    </div>
  );
}

function ChatItem({ message, isSelected, onSelect }: ChatItemProps) {
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
              <span key={i} className={`badge badge--${badge.type}`} title={badge.label}>
                {badge.type === 'moderator' && '🛡️'}
                {badge.type === 'member' && '⭐'}
                {badge.type === 'verified' && '✓'}
              </span>
            ))}
          </div>
          <time className="chatItem__time">{new Date(message.publishedAt).toLocaleTimeString()}</time>
        </div>
      </div>
      {message.superChat && (
        <div className="chatItem__superchat" style={{ backgroundColor: message.superChat.color }}>
          💰 {message.superChat.currency}{message.superChat.amount}
        </div>
      )}
      <p className="chatItem__text">{message.text}</p>
    </button>
  );
}

function MemberItem({ message, isSelected, onSelect }: ChatItemProps) {
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
            {message.membershipLevel || 'New member'}
          </span>
          <time className="memberItem__time">{new Date(message.publishedAt).toLocaleTimeString()}</time>
        </div>
      </div>
      {message.text && <p className="memberItem__text">{message.text}</p>}
    </button>
  );
}
