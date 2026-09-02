/** Backend origin. Empty means same origin, which is the case when the backend serves the built client. */
export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
