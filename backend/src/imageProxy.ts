import type { FastifyInstance, FastifyReply } from 'fastify';
import crypto from 'crypto';

type CachedImage = { buffer: Buffer; contentType: string; timestamp: number };

const ALLOWED_HOSTS = ['yt3.ggpht.com', 'yt4.ggpht.com', 'i.ytimg.com', 'lh3.googleusercontent.com'];
const CACHE_TTL = 1000 * 60 * 60 * 24;
const MAX_CACHE_SIZE = 1000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

const imageCache = new Map<string, CachedImage>();

function sendImage(reply: FastifyReply, image: CachedImage) {
  reply.header('Content-Type', image.contentType);
  reply.header('Cache-Control', 'public, max-age=86400');
  reply.header('Access-Control-Allow-Origin', '*');
  return reply.send(image.buffer);
}

/** GET /proxy/image?url= fetches YouTube CDN images through the backend so the browser does not hit CDN rate limits. */
export function registerImageProxy(fastify: FastifyInstance): void {
  fastify.get<{ Querystring: { url?: string } }>('/proxy/image', async (request, reply) => {
    const { url } = request.query;
    if (!url || typeof url !== 'string') {
      reply.status(400);
      return { error: 'url parameter is required' };
    }

    try {
      if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) {
        reply.status(403);
        return { error: 'Only YouTube CDN and Google User Content URLs are allowed' };
      }
    } catch {
      reply.status(400);
      return { error: 'Invalid URL' };
    }

    const cacheKey = crypto.createHash('md5').update(url).digest('hex');
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return sendImage(reply, cached);
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.youtube.com/' }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[Backend] Rate limited by YouTube CDN for:', url);
          if (cached) return sendImage(reply, cached);
        }
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const image: CachedImage = {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'image/jpeg',
        timestamp: Date.now()
      };
      imageCache.set(cacheKey, image);

      if (imageCache.size > MAX_CACHE_SIZE) {
        // Drop the oldest 20% so eviction is not a per-request cost.
        const entries = Array.from(imageCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (const [key] of entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2))) imageCache.delete(key);
      }

      return sendImage(reply, image);
    } catch (error) {
      console.error('[Backend] Failed to proxy image:', error);
      // A stale copy beats a broken avatar.
      if (cached) return sendImage(reply, cached);
      reply.status(500);
      return { error: 'Failed to fetch image' };
    }
  });
}
