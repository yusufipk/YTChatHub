import { BACKEND_URL } from './config';

const PROXIED_HOSTS = new Set(['yt3.ggpht.com', 'yt4.ggpht.com', 'i.ytimg.com', 'lh3.googleusercontent.com']);

/** Routes YouTube CDN images through the backend cache so OBS and the dashboard do not hit CDN rate limits. */
export function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (PROXIED_HOSTS.has(parsed.hostname)) {
      return `${BACKEND_URL}/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}
