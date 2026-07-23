import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXAID - Tanya SOP Bencana",
  description: "Chatbot RAG untuk menjawab pertanyaan operasional dari SOP bencana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
