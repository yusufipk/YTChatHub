import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import type { ChatMessage } from '@shared/chat';
import type { SavedSession } from './show';

/**
 * Keeps the chat of the current stream on disk, so a backend restart followed by a connect to the same live id
 * brings the dashboard back as it was (messages and the outro credits). Connecting to another live id replaces it.
 */

export type SavedChat = { liveId: string; savedAt: number; messages: ChatMessage[]; session: SavedSession };

const SAVE_DELAY_MS = 2000;
const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function createChatHistory(dataDir: string, collect: () => Omit<SavedChat, 'savedAt'> | null) {
  const file = path.join(dataDir, 'chat-history.json');
  let timer: NodeJS.Timeout | null = null;
  // Set by schedule(): only new chat is written, so a failed connect or a restore never overwrites a saved stream.
  let dirty = false;

  function load(liveId: string): SavedChat | null {
    try {
      const raw = readFileSync(file, 'utf8');
      if (raw.length > MAX_FILE_BYTES) return null;
      const saved = JSON.parse(raw) as Partial<SavedChat>;
      if (saved.liveId !== liveId || !Array.isArray(saved.messages)) return null;
      const session = saved.session;
      const validSession =
        session && typeof session.messages === 'number' && Array.isArray(session.chatters) && Array.isArray(session.supporters);
      return {
        liveId,
        savedAt: Number(saved.savedAt) || 0,
        messages: saved.messages.filter((m) => m && typeof m.id === 'string' && typeof m.author === 'string' && typeof m.text === 'string').map(sanitize),
        session: validSession ? session : { messages: 0, chatters: [], supporters: [] }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[History] Ignoring unreadable ${file}: ${(error as Error).message}`);
      return null;
    }
  }

  function writeNow() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return;
    dirty = false;
    const data = collect();
    if (!data) return;
    try {
      mkdirSync(dataDir, { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...data, savedAt: Date.now() }));
      renameSync(tmp, file);
    } catch (error) {
      console.warn(`[History] Could not save chat history: ${(error as Error).message}`);
    }
  }

  /** Coalesces a busy chat into one write per SAVE_DELAY_MS. */
  function schedule() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(writeNow, SAVE_DELAY_MS);
  }

  return { load, schedule, flush: writeNow };
}

const GOOGLE_IMAGE = /^https:\/\/([a-z0-9-]+\.)*(gstatic|ggpht|googleusercontent|ytimg)\.com\//i;

/** The file is our own output, but it is re-checked like live input in case it was edited by hand. */
function sanitize(message: ChatMessage): ChatMessage {
  const image = (url: string | undefined) => (url && GOOGLE_IMAGE.test(url) ? url : undefined);
  return {
    ...message,
    authorPhoto: image(message.authorPhoto),
    runs: Array.isArray(message.runs)
      ? message.runs.map((run) => ({
          ...run,
          url: run.url && /^https?:\/\//i.test(run.url) ? run.url : undefined,
          emojiUrl: image(run.emojiUrl)
        }))
      : undefined,
    gift: message.gift ? { ...message.gift, imageUrl: image(message.gift.imageUrl) } : undefined,
    superChat: message.superChat ? { ...message.superChat, stickerUrl: image(message.superChat.stickerUrl) } : undefined
  };
}

/** YouTube replays recent messages when a chat connects; this key spots them among restored ones. */
export function replayKey(message: ChatMessage): string {
  return `${message.id.replace(/#\d+$/, '')}\u0000${message.author}\u0000${message.text}`;
}
