"use client";

import { useEffect, useState, useCallback } from "react";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { createWalletClient, custom, parseEther, encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";

// --- AYARLAR ---
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; // Senin Kontrat Adresin

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
  const [context, setContext] = useState<Context.FrameContext>();
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // SDK'yı Yükle
  useEffect(() => {
    const load = async () => {
      setContext(await sdk.context);
      sdk.actions.ready();
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
      // Kullanıcının Farcaster Cüzdanına Bağlan
      // @ts-ignore
      const walletClient = createWalletClient({
        chain: baseSepolia,
        // @ts-ignore
        transport: custom(window.ethereum), // Farcaster'ın enjekte ettiği provider
      });

      const [address] = await walletClient.requestAddresses();

      // İşlem Verisini Hazırla
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: "deploy",
        args: [BigInt(selectedSquare)],
      });

      // İşlemi Gönder
      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        account: address,
        value: parseEther("0.0001"), // Yatırım miktarı
        data: data,
      });

      setTxHash(hash);
      alert(`🎉 Kazı Başladı! TX: ${hash}`);
      
      // İsteğe bağlı: İşlem bitince pencereyi kapat
      // sdk.actions.close(); 

    } catch (error) {
      console.error("Mining Error:", error);
      alert("Bir hata oluştu veya işlem reddedildi.");
    } finally {
      setIsMining(false);
    }
  }, [selectedSquare]);

  // --- ARAYÜZ (UI) ---
  return (
    <div className="w-full min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-2 text-yellow-400">BaseMiner ⛏️</h1>
      <p className="mb-6 text-slate-400 text-sm text-center">
        Şanslı kareyi bul, ödülü kap! <br/>
        <span className="text-xs">(Her kazı 0.0001 ETH)</span>
      </p>

      {/* 5x5 IZGARA ALANI */}
      <div className="grid grid-cols-5 gap-2 mb-8 bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-700">
        {Array.from({ length: 25 }).map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedSquare(index)}
            className={`
              w-12 h-12 rounded-md font-bold text-lg transition-all duration-200
              flex items-center justify-center
              ${selectedSquare === index 
                ? "bg-yellow-500 text-black scale-110 shadow-[0_0_15px_rgba(234,179,8,0.5)]" 
                : "bg-slate-700 hover:bg-slate-600 text-slate-500"}
            `}
          >
            {selectedSquare === index ? "⛏️" : index + 1}
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
              ? "bg-slate-700 text-slate-500 cursor-not-allowed" 
              : isMining 
                ? "bg-yellow-600 cursor-wait animate-pulse"
                : "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:scale-105"}
          `}
        >
          {isMining ? "Kazılıyor..." : selectedSquare === null ? "Bir Kare Seç" : `Kare #${selectedSquare + 1} Kazı Yap`}
        </button>
      </div>

      {/* BİLGİ / DURUM */}
      {txHash && (
        <div className="mt-4 p-3 bg-green-900/50 border border-green-500 rounded-lg text-xs break-all text-center max-w-xs">
          ✅ İşlem Gönderildi! <br/>
          <a 
            href={`https://sepolia.basescan.org/tx/${txHash}`} 
            target="_blank" 
            className="underline text-green-300"
          >
            Explorer'da Gör
          </a>
        </div>
      )}

      <div className="mt-auto pt-8 text-slate-600 text-xs">
        Contract: {CONTRACT_ADDRESS.slice(0,6)}...{CONTRACT_ADDRESS.slice(-4)}
      </div>
    </div>
  );
}