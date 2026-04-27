import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Funnel',
  description: 'High-conversion sales system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050505] text-white selection:bg-purple-500/30 overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}