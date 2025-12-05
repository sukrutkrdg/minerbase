import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";

export const metadata: Metadata = {
  title: "BaseMiner",
  description: "Base ağında madencilik oyunu",
  other: {
    // 🚨 KRİTİK DEĞİŞİKLİK: Eski cast butonları yerine "launch_frame" aksiyonu
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${appUrl}/opengraph-image`, // Veya public/grid.png
      button: {
        title: "⛏️ Oyunu Başlat",
        action: {
          type: "launch_frame",
          name: "BaseMiner",
          url: appUrl,
          splashImageUrl: `${appUrl}/icon.png`, // Veya grid.png
          splashBackgroundColor: "#0f172a",
        },
      },
    }),
  },
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