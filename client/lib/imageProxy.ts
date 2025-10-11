const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4100';

/**
 * Converts a YouTube CDN image URL to use our backend proxy
 * This prevents 429 rate limit errors from YouTube's CDN
 */
export function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // Check if it's a YouTube CDN URL
  const youtubeCdnDomains = ['yt3.ggpht.com', 'yt4.ggpht.com', 'i.ytimg.com'];
  
  try {
    const urlObj = new URL(url);
    if (youtubeCdnDomains.includes(urlObj.hostname)) {
      // Proxy through our backend
      return `${BACKEND_URL}/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
  
  // Return non-YouTube URLs as-is
  return url;
}

