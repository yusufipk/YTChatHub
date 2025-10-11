import './globals.css';
import type { ReactNode } from 'react';
import { TimezoneProvider } from '../lib/TimezoneContext';

export const metadata = {
  title: 'YouTube Chat Client',
  description: 'High-performance YouTube Live chat dashboard'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TimezoneProvider>
          {children}
        </TimezoneProvider>
      </body>
    </html>
  );
}
