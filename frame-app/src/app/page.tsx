import { getFrameMetadata } from '@coinbase/onchainkit/frame';
import type { Metadata } from 'next';

// --- Frame Ayarları ---
const FRAME_URL = process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';

// Frame Metadata'sını oluşturuyoruz
const frameMetadata = getFrameMetadata({
  buttons: [
    {
      label: '⛏️ Oyuna Başla (Deploy)',
    },
  ],
  image: {
    src: `${FRAME_URL}/grid.png`, // Oyun tahtası görseli
    aspectRatio: '1:1',
  },
  // Butona basılınca gidilecek API rotası
  postUrl: `${FRAME_URL}/api/frame`, 
});

export const metadata: Metadata = {
  title: 'BaseMiner',
  description: 'Base ağında madencilik oyunu',
  openGraph: {
    title: 'BaseMiner',
    description: 'Base ağında madencilik oyunu',
    images: [`${FRAME_URL}/grid.png`],
  },
  other: {
    ...frameMetadata,
  },
};

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold">BaseMiner ⛏️</h1>
        <p className="mt-4 text-xl">
          Farcaster üzerinde Base madenciliği yap!
        </p>
        {/* Frame'ler normal tarayıcıda sadece görsel olarak gözükür */}
        <div className="mt-8">
            <img src="/grid.png" alt="Game Board" width={500} height={500} />
        </div>
      </main>
    </div>
  );
}