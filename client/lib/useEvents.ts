'use client';

import { useEffect, useReducer } from 'react';
import type { ChatMessage, ConnectionStatus, Poll, ServerEvent, ServerEventType } from '@shared/chat';
import type { ShowState } from '@shared/show';
import { BACKEND_URL } from './config';

export type StreamState = 'connecting' | 'open' | 'error';

export type EventsState = {
  stream: StreamState;
  status: ConnectionStatus;
  messages: ChatMessage[];
  selection: ChatMessage | null;
  poll: Poll | null;
  /** Null until the first `init` arrives. */
  show: ShowState | null;
  /** Server clock minus local clock, in ms, measured on the latest show snapshot. */
  clockOffset: number;
};

const MAX_REGULAR = 200;
const EVENT_TYPES = new Set<ServerEventType>(['init', 'message', 'selection', 'poll', 'status', 'show', 'clear']);
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 10_000;

const initialState: EventsState = {
  stream: 'connecting',
  status: { state: 'disconnected', liveId: null },
  messages: [],
  selection: null,
  poll: null,
  show: null,
  clockOffset: 0
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
      return { ...state, status: action.status, messages: action.messages, selection: action.selection, poll: action.poll, show: action.show, clockOffset: action.show.serverNow - Date.now() };
    case 'message':
      return { ...state, messages: append(state.messages, action.message) };
    case 'selection':
      return { ...state, selection: action.message };
    case 'poll':
      return { ...state, poll: action.poll };
    case 'status':
      return { ...state, status: action.status };
    case 'show':
      return { ...state, show: action.show, clockOffset: action.show.serverNow - Date.now() };
    case 'clear':
      return { ...state, messages: [], selection: null, poll: null };
    default:
      return state;
  }
}

function socketUrl(): string {
  const base = new URL(BACKEND_URL || window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/ws';
  return base.toString();
}

/**
 * Single WebSocket subscription to the backend (see the server for why not SSE).
 * It reconnects with backoff, and the server replays the full state in `init` on every connect.
 */
export function useEvents(): EventsState {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        attempt = 0;
        dispatch({ type: 'stream', stream: 'open' });
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as ServerEvent;
          if (EVENT_TYPES.has(data.type)) dispatch(data);
        } catch (error) {
          console.error('Bad event payload', error);
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        dispatch({ type: 'stream', stream: 'error' });
        const delay = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** attempt);
        attempt += 1;
        retry = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return state;
}
