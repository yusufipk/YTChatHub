import { BACKEND_URL } from './config';

async function call<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, init);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = String(body.error);
    } catch {
      // body was not JSON
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const api = {
  connect: (liveId: string) => call<{ ok: true; liveId: string }>('/chat/connect', json({ liveId })),
  disconnect: () => call('/chat/disconnect', { method: 'POST' }),
  select: (id: string) => call('/overlay/selection', json({ id })),
  clearSelection: () => call('/overlay/selection', { method: 'DELETE' })
};
