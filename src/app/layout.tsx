import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sea N Shore WhatsApp",
  description: "WhatsApp marketing operations for Sea N Shore",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
