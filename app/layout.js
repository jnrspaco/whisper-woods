import './globals.css';

export const metadata = {
  title: 'Whisper Woods — An AI Horror Experience',
  description: 'A text-based horror game powered by AI narration and dynamic soundscapes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
