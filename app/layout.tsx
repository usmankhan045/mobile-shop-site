import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./scanner.css";

export const metadata: Metadata = {
  title: "Ledgerline — Mobile Shop Operations",
  description: "A focused mobile shop inventory and ledger workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
