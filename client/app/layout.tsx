import './globals.css';
import './show.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'YTChatHub',
  description: 'YouTube Live chat dashboard with an OBS overlay'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
