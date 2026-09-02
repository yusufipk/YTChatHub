'use client';

import { useEffect, useReducer } from 'react';
import type { ChatMessage, ConnectionStatus, Poll, ServerEvent, ServerEventType } from '@shared/chat';
import { BACKEND_URL } from './config';

export type StreamState = 'connecting' | 'open' | 'error';

export type EventsState = {
  stream: StreamState;
  status: ConnectionStatus;
  messages: ChatMessage[];
  selection: ChatMessage | null;
  poll: Poll | null;
};

const MAX_REGULAR = 200;
const EVENT_TYPES: ServerEventType[] = ['init', 'message', 'selection', 'poll', 'status', 'clear'];

const initialState: EventsState = {
  stream: 'connecting',
  status: { state: 'disconnected', liveId: null },
  messages: [],
  selection: null,
  poll: null
};

export function isSpecial(message: ChatMessage): boolean {
  return !!(message.superChat || message.membershipGift || message.membershipGiftPurchase);
}

/** Appends a message and drops the oldest regular ones past the cap. Special messages are always kept. */
function append(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const next = [...list, message];
  let regular = 0;
  for (const item of next) if (!isSpecial(item)) regular += 1;
  let drop = regular - MAX_REGULAR;
  if (drop <= 0) return next;
  return next.filter((item) => {
    if (drop > 0 && !isSpecial(item)) {
      drop -= 1;
      return false;
    }
    return true;
  });
}

type Action = ServerEvent | { type: 'stream'; stream: StreamState };

function reducer(state: EventsState, action: Action): EventsState {
  switch (action.type) {
    case 'stream':
      return { ...state, stream: action.stream };
    case 'init':
      return { ...state, status: action.status, messages: action.messages, selection: action.selection, poll: action.poll };
    case 'message':
      return { ...state, messages: append(state.messages, action.message) };
    case 'selection':
      return { ...state, selection: action.message };
    case 'poll':
      return { ...state, poll: action.poll };
    case 'status':
      return { ...state, status: action.status };
    case 'clear':
      return { ...state, messages: [], selection: null, poll: null };
    default:
      return state;
  }
}

/** Single SSE subscription to the backend. EventSource reconnects on its own and the server replays state on `init`. */
export function useEvents(): EventsState {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const source = new EventSource(`${BACKEND_URL}/events`);
    const onEvent = (event: Event) => {
      try {
        dispatch(JSON.parse((event as MessageEvent).data));
      } catch (error) {
        console.error('Bad event payload', error);
      }
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, onEvent);
    source.onopen = () => dispatch({ type: 'stream', stream: 'open' });
    source.onerror = () => dispatch({ type: 'stream', stream: 'error' });
    return () => source.close();
  }, []);

  return state;
}
