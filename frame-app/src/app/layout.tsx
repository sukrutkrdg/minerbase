import type { Metadata } from "next";
import "./globals.css"; // Eğer globals.css varsa

// Vercel URL'in (Otomatik alır veya sen elle yazarsın)
const appUrl = process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";

export const metadata: Metadata = {
  title: "BaseMiner",
  description: "Base ağında madencilik oyunu",
  other: {
    // FRAME v2 METADATA STANDARDI
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${appUrl}/grid.png`, // Kapak görseli
      button: {
        title: "⛏️ Oyunu Başlat", // Feed'de görünecek buton
        action: {
          type: "launch_frame",
          name: "BaseMiner",
          url: appUrl, // Butona basınca açılacak sayfa (bizim page.tsx)
          splashImageUrl: `${appUrl}/grid.png`,
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