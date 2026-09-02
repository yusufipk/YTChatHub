'use client';

import { ArrowDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatMessage } from '@shared/chat';

type Props = {
  messages: ChatMessage[];
  paused?: boolean;
  render: (message: ChatMessage) => ReactNode;
  empty: string;
};

const BOTTOM_THRESHOLD = 80;

/**
 * Scroll container that follows new messages while the user is at the bottom.
 * Scrolling up stops following and shows a jump button with the unseen count.
 * While paused the list is frozen at its current contents.
 */
export function ChatList({ messages, paused = false, render, empty }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const [frozen, setFrozen] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    setFrozen(paused ? messages : null);
    // Only the pause flag should snapshot; message updates while paused must not refresh the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const shown = frozen ?? messages;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (following.current) {
      node.scrollTop = node.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((count) => count + 1);
    }
  }, [shown]);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= BOTTOM_THRESHOLD;
    following.current = atBottom;
    if (atBottom) setUnseen(0);
  };

  const jump = () => {
    const node = scroller.current;
    if (!node) return;
    following.current = true;
    node.scrollTop = node.scrollHeight;
    setUnseen(0);
  };

  return (
    <div className="list">
      <div className="list__scroll" ref={scroller} onScroll={onScroll}>
        {shown.length ? shown.map(render) : <p className="list__empty">{empty}</p>}
      </div>
      {unseen > 0 && !following.current && (
        <button type="button" className="list__jump" onClick={jump}>
          <ArrowDown size={14} />
          {unseen} new
        </button>
      )}
      {paused && frozen && messages.length > frozen.length && (
        <span className="list__paused">Paused, {messages.length - frozen.length} waiting</span>
      )}
    </div>
  );
}
