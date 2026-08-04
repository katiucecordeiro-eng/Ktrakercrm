import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Frota x Suprimentos | Gestão em Movimento",
  description: "Ecossistema Frota x Suprimentos — solicitação e padronização de itens do catálogo Benner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
