/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the backend serves `client/out` so production runs on a single port.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true }
};

module.exports = nextConfig;
