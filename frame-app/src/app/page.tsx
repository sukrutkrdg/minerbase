"use client";

import { useEffect, useState, useCallback } from "react";
import sdk from "@farcaster/frame-sdk";
import { 
  createWalletClient, 
  createPublicClient, 
  http, 
  custom, 
  parseEther, 
  formatEther, 
  encodeFunctionData 
} from "viem";
import { baseSepolia } from "viem/chains";

// --- TİP TANIMLAMALARI ---
type FrameContext = Awaited<typeof sdk.context>;

interface RoundData {
  id: number;
  endTime: number;
  totalEth: string;
  stakes: bigint[];
  finalized: boolean;
  winner: number;
}

// --- AYARLAR ---
// ⚠️ DİKKAT: Yeni "getRoundDetails" fonksiyonunu eklediğin kontratın adresini buraya yazmalısın.
// Eski adres çalışmayacaktır çünkü o kontratta bu view fonksiyonu yok.
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; 

const CONTRACT_ABI = [
  // Write (Yazma) Fonksiyonları
  {
    "type": "function",
    "name": "deploy",
    "inputs": [{ "name": "square", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  },
  // Read (Okuma) Fonksiyonları
  {
    "type": "function",
    "name": "roundId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoundDetails",
    "inputs": [{ "name": "_roundId", "type": "uint256" }],
    "outputs": [
      { "name": "endTime", "type": "uint256" },
      { "name": "totalEth", "type": "uint256" },
      { "name": "squareStakes", "type": "uint256[25]" },
      { "name": "finalized", "type": "bool" },
      { "name": "winner", "type": "uint256" }
    ],
    "stateMutability": "view"
  }
] as const;

export default function Page() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext>();
  
  // Oyun State'leri
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Veri State'leri
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("Yükleniyor...");

  // Public Client (Okuma işlemleri için)
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org") // Public RPC
  });

  // --- BAŞLANGIÇ AYARLARI ---
  useEffect(() => {
    const load = async () => {
      const ctx = await sdk.context;
      setContext(ctx);
      sdk.actions.ready();
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  // --- VERİ ÇEKME (READ) ---
  const fetchData = useCallback(async () => {
    try {
      // 1. Mevcut Tur ID'sini al
      const currentRoundId = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "roundId"
      });

      // 2. Tur Detaylarını al
      // Not: getRoundDetails fonksiyonu diziden (array) veri döndürür
      const details = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getRoundDetails",
        args: [currentRoundId]
      });

      // Viem'den dönen veriyi formatla
      setRoundData({
        id: Number(currentRoundId),
        endTime: Number(details[0]),
        totalEth: formatEther(details[1]),
        stakes: details[2] as unknown as bigint[], // Type casting gerekebilir
        finalized: details[3],
        winner: Number(details[4])
      });

    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
  }, [publicClient]);

  // Periyodik Veri Güncelleme
  useEffect(() => {
    fetchData(); // İlk açılışta çek
    const interval = setInterval(fetchData, 3000); // 3 saniyede bir güncelle
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- GERİ SAYIM SAYACI ---
  useEffect(() => {
    if (!roundData) return;

    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = roundData.endTime - now;

      if (roundData.finalized) {
        setTimeLeft("🏁 Tur Bitti");
      } else if (diff <= 0) {
        setTimeLeft("⏳ Süre Doldu (Reset Bekleniyor)");
      } else {
        const min = Math.floor(diff / 60);
        const sec = diff % 60;
        setTimeLeft(`${min}dk ${sec}sn`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [roundData]);

  // --- MADENCİLİK (WRITE) ---
  const handleDeploy = useCallback(async () => {
    if (selectedSquare === null) return;
    setIsMining(true);
    setTxHash(null);

    try {
      const provider = sdk.wallet.ethProvider;
      if (!provider) throw new Error("Cüzdan bulunamadı.");

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
      
      // İşlem başarılı olunca veriyi hemen yenilemeyi dene
      setTimeout(() => fetchData(), 2000);

    } catch (error: any) {
      console.error("Mining Error:", error);
    } finally {
      setIsMining(false);
    }
  }, [selectedSquare, fetchData]);

  // --- ARAYÜZ (UI) ---
  return (
    <div className="w-full min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-start overflow-y-auto">
      
      {/* BAŞLIK VE İSTATİSTİKLER */}
      <div className="text-center mb-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-yellow-400 drop-shadow-md mb-1">BaseMiner ⛏️</h1>
        
        {roundData ? (
          <div className="flex justify-between items-center bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs sm:text-sm">
            <div className="text-left">
              <p className="text-slate-400">Tur</p>
              <p className="font-bold text-white">#{roundData.id}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400">Havuz</p>
              <p className="font-bold text-green-400">{Number(roundData.totalEth).toFixed(4)} ETH</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Süre</p>
              <p className={`font-bold ${roundData.finalized ? 'text-red-400' : 'text-yellow-200'}`}>
                {timeLeft}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-xs animate-pulse">Veriler yükleniyor...</p>
        )}
      </div>

      {/* 5x5 IZGARA ALANI */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-8 bg-slate-900/50 p-3 sm:p-4 rounded-2xl shadow-xl border border-slate-800">
        {Array.from({ length: 25 }).map((_, index) => {
          // Bu kareye yatırım yapılmış mı?
          const stakeAmount = roundData?.stakes ? Number(formatEther(roundData.stakes[index])) : 0;
          const isWinner = roundData?.finalized && roundData?.winner === index;
          
          return (
            <button
              key={index}
              onClick={() => !roundData?.finalized && setSelectedSquare(index)}
              disabled={roundData?.finalized}
              className={`
                w-12 h-12 sm:w-16 sm:h-16 rounded-xl font-bold text-lg transition-all duration-200
                flex flex-col items-center justify-center relative overflow-hidden
                ${isWinner 
                  ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.6)] border-2 border-white scale-110 z-20" 
                  : selectedSquare === index 
                    ? "bg-slate-700 border-2 border-yellow-400/50" 
                    : "bg-slate-800 hover:bg-slate-750 border border-slate-700"}
              `}
            >
              {/* Kare Numarası */}
              <span className={`absolute top-0.5 left-1 text-[8px] sm:text-[10px] ${isWinner ? 'text-yellow-900' : 'text-slate-600'}`}>
                #{index + 1}
              </span>

              {/* Yatırım Miktarı (Varsa Göster) */}
              {stakeAmount > 0 && (
                <span className={`text-[9px] sm:text-[10px] font-mono mt-3 ${isWinner ? 'text-black font-bold' : 'text-green-400'}`}>
                  {stakeAmount.toFixed(3)}
                </span>
              )}

              {/* Seçim İkonu veya Kazanan İkonu */}
              {isWinner ? (
                <span className="absolute bottom-0 text-xl animate-bounce">🏆</span>
              ) : selectedSquare === index ? (
                <span className="absolute bottom-1 text-sm sm:text-base animate-pulse">⛏️</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* AKSİYON BUTONU */}
      <div className="w-full max-w-xs">
        <button
          onClick={handleDeploy}
          disabled={selectedSquare === null || isMining || !!roundData?.finalized}
          className={`
            w-full py-4 rounded-xl font-bold text-xl shadow-lg
            transition-all duration-300
            ${roundData?.finalized
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              : selectedSquare === null 
                ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                : isMining 
                  ? "bg-yellow-700 cursor-wait animate-pulse text-yellow-200"
                  : "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black hover:scale-105 hover:shadow-yellow-500/20"}
          `}
        >
          {roundData?.finalized 
            ? "Tur Sona Erdi" 
            : isMining 
              ? "⛏️ Kazılıyor..." 
              : selectedSquare === null 
                ? "Bir Kare Seç" 
                : `KAZI YAP! (#${selectedSquare + 1})`}
        </button>
        
        {/* Kazı Maliyeti Bilgisi */}
        {!roundData?.finalized && (
          <p className="text-center text-[10px] text-slate-500 mt-2">
            Maliyet: 0.0001 ETH + Gas
          </p>
        )}
      </div>

      {/* İŞLEM BİLGİSİ */}
      {txHash && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-center max-w-xs animate-fade-in backdrop-blur-sm">
          ✅ <span className="font-bold text-green-400">İşlem Gönderildi!</span> <br/>
          <a 
            href={`https://sepolia.basescan.org/tx/${txHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline text-green-300/70 hover:text-green-200 mt-1 inline-block"
          >
            Explorer'da Görüntüle
          </a>
        </div>
      )}
    </div>
  );
}