const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/;

/**
 * Extracts the 11-character video id from a bare id or any YouTube URL
 * (watch?v=, youtu.be/, /live/, /embed/, with or without scheme). Returns '' for anything else.
 */
export function extractLiveId(input: string | undefined): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '';
  if (VIDEO_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return '';
  }
  if (!YOUTUBE_HOST.test(url.hostname)) return '';

  const candidate = url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
  return VIDEO_ID.test(candidate) ? candidate : '';
}
