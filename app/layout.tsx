import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crosslink · Real-time network Tic-Tac-Toe",
  description:
    "Real-time multiplayer Tic-Tac-Toe with matchmaking, chat, stats, and live connection telemetry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
