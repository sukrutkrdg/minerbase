"use client";

import { useEffect, useState, useCallback } from "react";
import sdk from "@farcaster/frame-sdk";
import { createWalletClient, custom, parseEther, encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";

// Tipi otomatik algıla
type FrameContext = Awaited<typeof sdk.context>;

// --- AYARLAR ---
// DEPLOY ETTİĞİN KONTRAT ADRESİ
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; 

const CONTRACT_ABI = [
  {
    "type": "function",
    "name": "deploy",
    "inputs": [{ "name": "square", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  }
] as const;

export default function Page() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext>();
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // SDK'yı Yükle ve Hazır Hale Getir
  useEffect(() => {
    const load = async () => {
      const ctx = await sdk.context;
      setContext(ctx);
      sdk.actions.ready(); // Frame'in yüklendiğini Farcaster'a bildirir
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  // --- MADENCİLİK FONKSİYONU ---
  const handleDeploy = useCallback(async () => {
    if (selectedSquare === null) return;
    setIsMining(true);
    setTxHash(null);

    try {
      // Mini App'lerde cüzdan için sdk.wallet.ethProvider kullanılır
      const provider = sdk.wallet.ethProvider;
      if (!provider) {
        throw new Error("Farcaster cüzdanı bulunamadı.");
      }

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      const [address] = await walletClient.requestAddresses();

      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: "deploy",
        args: [BigInt(selectedSquare)],
      });

      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        account: address,
        value: parseEther("0.0001"),
        data: data,
        chain: baseSepolia
      });

      setTxHash(hash);

    } catch (error: any) {
      console.error("Mining Error:", error);
      // Kullanıcıya hata mesajını gösterelim (opsiyonel)
      // alert(`Hata: ${error.message}`); 
    } finally {
      setIsMining(false);
    }
  }, [selectedSquare]);

  // --- ARAYÜZ (UI) ---
  return (
    <div className="w-full min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-start overflow-y-auto">
      <h1 className="text-3xl font-bold mb-2 text-yellow-400 drop-shadow-md">BaseMiner ⛏️</h1>
      <p className="mb-6 text-slate-400 text-sm text-center">
        Şanslı kareyi bul, ödülü kap! <br/>
        <span className="text-xs text-yellow-600/80">(Her kazı 0.0001 ETH)</span>
      </p>

      {/* 5x5 IZGARA ALANI */}
      <div className="grid grid-cols-5 gap-3 mb-8 bg-slate-900/50 p-4 rounded-2xl shadow-xl border border-slate-800">
        {Array.from({ length: 25 }).map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedSquare(index)}
            className={`
              w-14 h-14 sm:w-16 sm:h-16 rounded-xl font-bold text-2xl transition-all duration-200
              flex items-center justify-center relative
              ${selectedSquare === index 
                ? "bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/50 z-10 border-2 border-yellow-300" 
                : "bg-slate-800 hover:bg-slate-700 text-slate-600 border border-slate-700"}
            `}
          >
            {selectedSquare === index ? <span className="animate-bounce">⛏️</span> : null}
          </button>
        ))}
      </div>

      {/* AKSİYON BUTONU */}
      <div className="w-full max-w-xs">
        <button
          onClick={handleDeploy}
          disabled={selectedSquare === null || isMining}
          className={`
            w-full py-4 rounded-xl font-bold text-xl shadow-lg
            transition-all duration-300
            ${selectedSquare === null 
              ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
              : isMining 
                ? "bg-yellow-700 cursor-wait animate-pulse text-yellow-200"
                : "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black hover:scale-105 hover:shadow-yellow-500/20"}
          `}
        >
          {isMining ? "⛏️ Kazılıyor..." : selectedSquare === null ? "Bir Kare Seç" : `KAZI YAP! (#${selectedSquare + 1})`}
        </button>
      </div>

      {/* BİLGİ / DURUM */}
      {txHash && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-xs text-center max-w-xs animate-fade-in">
          ✅ <span className="font-bold text-green-400">İşlem Gönderildi!</span> <br/>
          <a 
            href={`https://sepolia.basescan.org/tx/${txHash}`} 
            target="_blank" 
            className="underline text-green-300/80 hover:text-green-200"
          >
            Explorer'da Gör
          </a>
        </div>
      )}
    </div>
  );
}