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

// --- SABİTLER ---
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244";
const ENTRY_FEE = "0.0001"; // ETH cinsinden giriş ücreti

const CONTRACT_ABI = [
  // Write (Yazma)
  {
    "type": "function",
    "name": "deploy",
    "inputs": [{ "name": "square", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  },
  // Read (Okuma)
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [context, setContext] = useState<FrameContext>();
  
  // Oyun State'leri
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Veri State'leri
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("Yükleniyor...");
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Public Client (Okuma işlemleri için - Memoized dışarıda tutulabilir ama burada da ok)
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org")
  });

  // --- BAŞLANGIÇ AYARLARI ---
  useEffect(() => {
    const load = async () => {
      const ctx = await sdk.context;
      setContext(ctx);
      sdk.actions.ready(); // Frame yüklendiğinde Farcaster'a bildir
      setIsSDKLoaded(true);
    };
    if (sdk && !isSDKLoaded) {
      load();
    }
  }, [isSDKLoaded]);

  // --- VERİ ÇEKME (READ) ---
  const fetchData = useCallback(async () => {
    try {
      const currentRoundId = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "roundId"
      });

      const details = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getRoundDetails",
        args: [currentRoundId]
      });

      // Viem tip dönüşümleri
      setRoundData({
        id: Number(currentRoundId),
        endTime: Number(details[0]),
        totalEth: formatEther(details[1]),
        stakes: details[2] as unknown as bigint[],
        finalized: details[3],
        winner: Number(details[4])
      });
      setFetchError(false);

    } catch (error) {
      console.error("Veri çekme hatası:", error);
      setFetchError(true);
    }
  }, [publicClient]);

  // Periyodik Veri Güncelleme
  useEffect(() => {
    fetchData(); 
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- GERİ SAYIM SAYACI ---
  useEffect(() => {
    if (!roundData) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = roundData.endTime - now;

      if (roundData.finalized) {
        setTimeLeft("🏁 Tur Bitti");
      } else if (diff <= 0) {
        setTimeLeft("⏳ Reset Bekleniyor...");
      } else {
        const min = Math.floor(diff / 60);
        const sec = diff % 60;
        setTimeLeft(`${min}dk ${sec < 10 ? '0' + sec : sec}sn`);
      }
    };

    updateTimer(); // İlk renderda hemen çalıştır
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [roundData]);

  // --- MADENCİLİK (WRITE) ---
  const handleDeploy = useCallback(async () => {
    if (selectedSquare === null) return;
    setIsMining(true);
    setTxHash(null);

    try {
      // SDK provider kontrolü
      const provider = sdk.wallet.ethProvider;
      if (!provider) {
        alert("Cüzdan sağlayıcısı bulunamadı. Lütfen Frame uyumlu bir istemci kullanın.");
        throw new Error("Cüzdan bulunamadı.");
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
        value: parseEther(ENTRY_FEE), // Sabit değişkenden alıyoruz
        data: data,
        chain: baseSepolia
      });

      setTxHash(hash);
      
      // Hızlı güncelleme için kısa bir bekleyiş
      setTimeout(() => fetchData(), 2000);

    } catch (error: any) {
      console.error("Mining Error:", error);
      // Kullanıcı reddettiyse veya hata olduysa
    } finally {
      setIsMining(false);
    }
  }, [selectedSquare, fetchData]);

  // --- ARAYÜZ (UI) ---
  if (!isSDKLoaded) {
    return <div className="w-full h-screen flex items-center justify-center bg-slate-950 text-white">Yükleniyor...</div>;
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center justify-start overflow-y-auto font-sans select-none">
      
      {/* BAŞLIK VE İSTATİSTİKLER */}
      <div className="text-center mb-6 w-full max-w-sm">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 drop-shadow-sm mb-2">
          BaseMiner ⛏️
        </h1>
        
        {fetchError && (
           <div className="bg-red-900/50 text-red-200 text-xs p-2 rounded mb-2 border border-red-800">
             Veri bağlantısında sorun var. Otomatik tekrar deneniyor...
           </div>
        )}

        {roundData ? (
          <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs shadow-inner">
            <div className="flex flex-col items-start">
              <span className="text-slate-400 font-medium">Tur</span>
              <span className="font-bold text-white text-sm">#{roundData.id}</span>
            </div>
            <div className="flex flex-col items-center border-l border-r border-slate-800">
              <span className="text-slate-400 font-medium">Havuz</span>
              <span className="font-bold text-green-400 text-sm">{Number(roundData.totalEth).toFixed(4)} ETH</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 font-medium">Süre</span>
              <span className={`font-bold text-sm ${roundData.finalized ? 'text-red-400' : 'text-yellow-300'}`}>
                {timeLeft}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-16 w-full bg-slate-900 animate-pulse rounded-xl"></div>
        )}
      </div>

      {/* 5x5 IZGARA ALANI */}
      <div className="relative mb-8">
        <div className="grid grid-cols-5 gap-2 p-3 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 ring-1 ring-slate-800">
          {Array.from({ length: 25 }).map((_, index) => {
            const stakeAmount = roundData?.stakes ? Number(formatEther(roundData.stakes[index])) : 0;
            const isWinner = roundData?.finalized && roundData?.winner === index;
            const isSelected = selectedSquare === index;
            
            return (
              <button
                key={index}
                onClick={() => !roundData?.finalized && setSelectedSquare(index)}
                disabled={!!roundData?.finalized}
                className={`
                  w-12 h-12 sm:w-14 sm:h-14 rounded-xl transition-all duration-200
                  flex flex-col items-center justify-center relative overflow-hidden group
                  ${isWinner 
                    ? "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.6)] border-2 border-white z-10 scale-105" 
                    : isSelected 
                      ? "bg-slate-700 border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]" 
                      : "bg-slate-800 hover:bg-slate-750 border border-slate-700/50 hover:border-slate-600"}
                `}
              >
                {/* Kare Numarası */}
                <span className={`absolute top-1 left-1.5 text-[9px] font-mono leading-none ${isWinner ? 'text-yellow-900 font-bold' : 'text-slate-600'}`}>
                  {index + 1}
                </span>

                {/* Yatırım Varsa Göster */}
                {stakeAmount > 0 && (
                  <div className="flex flex-col items-center justify-center h-full pt-2">
                    <span className={`text-[9px] font-bold ${isWinner ? 'text-black' : 'text-green-400'}`}>
                      {stakeAmount.toFixed(3)}
                    </span>
                  </div>
                )}

                {/* Seçim / Kazanan İkonları */}
                {isWinner && <span className="absolute -bottom-1 -right-1 text-xl animate-bounce">🏆</span>}
                {!isWinner && isSelected && <span className="absolute bottom-1 right-1 text-xs opacity-80">⛏️</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* AKSİYON BUTONU */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={handleDeploy}
          disabled={selectedSquare === null || isMining || !!roundData?.finalized}
          className={`
            w-full py-4 rounded-xl font-bold text-lg shadow-lg relative overflow-hidden
            transition-all duration-300 transform active:scale-95
            ${roundData?.finalized
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              : selectedSquare === null 
                ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                : isMining 
                  ? "bg-yellow-700 cursor-wait text-yellow-200/80"
                  : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:shadow-yellow-500/20 hover:brightness-110"}
          `}
        >
          {roundData?.finalized 
            ? "Tur Tamamlandı" 
            : isMining 
              ? (
                <div className="flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                   <span>İşleniyor...</span>
                </div>
              )
              : selectedSquare === null 
                ? "Bir Kare Seç" 
                : `KAZI YAP (#${selectedSquare + 1})`}
        </button>
        
        {/* Kazı Maliyeti Bilgisi */}
        {!roundData?.finalized && (
          <div className="flex justify-between text-[10px] text-slate-500 px-2 font-mono">
             <span>Maliyet: {ENTRY_FEE} ETH</span>
             <span>+ Gas Ücreti</span>
          </div>
        )}
      </div>

      {/* İŞLEM BİLGİSİ (SUCCESS TOAST) */}
      {txHash && (
        <div className="mt-6 w-full max-w-xs bg-green-950/40 border border-green-500/30 rounded-lg p-3 text-center animate-fade-in backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-1">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
             <span className="font-bold text-green-400 text-sm">İşlem Gönderildi!</span>
          </div>
          <a 
            href={`https://sepolia.basescan.org/tx/${txHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-green-300/60 hover:text-green-200 underline decoration-dotted underline-offset-2"
          >
            Explorer'da Görüntüle ↗
          </a>
        </div>
      )}
    </div>
  );
}