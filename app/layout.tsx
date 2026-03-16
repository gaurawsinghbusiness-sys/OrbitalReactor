import type {Metadata} from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Orbital Meltdown',
  description: 'A co-op UI puzzle game powered by Gemini Live API',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable}`}>
      <body className="font-mono bg-zinc-950 text-cyan-400 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
