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
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; // Kontrat adresin
const ENTRY_FEE = "0.0001"; // ETH Giriş Ücreti

const CONTRACT_ABI = [
  // Write Functions
  {
    "type": "function",
    "name": "deploy",
    "inputs": [{ "name": "square", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "reset",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // Read Functions
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
  
  // Oyun Durumları
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Mining veya Reset işlemi için ortak loading
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Veri Durumları
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [timeLeftLabel, setTimeLeftLabel] = useState<string>("Yükleniyor...");
  const [isRoundOver, setIsRoundOver] = useState(false); // Süre bitti mi?
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Public Client (Okuma işlemleri)
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org")
  });

  // --- BAŞLANGIÇ ---
  useEffect(() => {
    const load = async () => {
      const ctx = await sdk.context;
      setContext(ctx);
      sdk.actions.ready();
      setIsSDKLoaded(true);
    };
    if (sdk && !isSDKLoaded) {
      load();
    }
  }, [isSDKLoaded]);

  // --- VERİ ÇEKME ---
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
      console.error("Veri hatası:", error);
      setFetchError(true);
    }
  }, [publicClient]);

  // Periyodik güncelleme
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- SAYAÇ ---
  useEffect(() => {
    if (!roundData) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = roundData.endTime - now;

      if (roundData.finalized) {
        setTimeLeftLabel("🏁 Tur Bitti");
        setIsRoundOver(true);
      } else if (diff <= 0) {
        setTimeLeftLabel("⏳ Süre Doldu");
        setIsRoundOver(true);
      } else {
        const min = Math.floor(diff / 60);
        const sec = diff % 60;
        setTimeLeftLabel(`${min}dk ${sec < 10 ? '0' + sec : sec}sn`);
        setIsRoundOver(false);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [roundData]);

  // --- İŞLEM FONKSİYONU (DEPLOY veya RESET) ---
  const handleTransaction = useCallback(async (type: 'deploy' | 'reset') => {
    if (type === 'deploy' && selectedSquare === null) return;
    
    setIsLoading(true);
    setTxHash(null);

    try {
      const provider = sdk.wallet.ethProvider;
      if (!provider) throw new Error("Cüzdan bulunamadı (Frame içinde misiniz?)");

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      const [address] = await walletClient.requestAddresses();
      let data, value;

      if (type === 'deploy') {
        data = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: "deploy",
          args: [BigInt(selectedSquare!)],
        });
        value = parseEther(ENTRY_FEE);
      } else {
        // Reset işlemi
        data = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: "reset",
          args: [],
        });
        value = BigInt(0);
      }

      const hash = await walletClient.sendTransaction({
        to: CONTRACT_ADDRESS,
        account: address,
        value: value,
        data: data,
        chain: baseSepolia
      });

      setTxHash(hash);
      // İşlem onaylanana kadar beklemeden arayüzü güncellemeye çalış
      setTimeout(() => fetchData(), 2000);

    } catch (error) {
      console.error("İşlem hatası:", error);
      alert("İşlem başarısız oldu. Konsolu kontrol edin.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSquare, fetchData]);

  if (!isSDKLoaded) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Yükleniyor...</div>;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center overflow-y-auto font-sans">
      
      {/* BAŞLIK */}
      <div className="text-center mb-6 w-full max-w-sm">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-2 drop-shadow-sm">
          BaseMiner ⛏️
        </h1>
        
        {fetchError && (
          <div className="mb-2 p-2 text-xs bg-red-900/50 border border-red-800 text-red-200 rounded">
            Bağlantı sorunu var, tekrar deneniyor...
          </div>
        )}

        {roundData ? (
          <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs shadow-inner">
            <div className="flex flex-col items-start">
              <span className="text-slate-400">Tur</span>
              <span className="font-bold text-white">#{roundData.id}</span>
            </div>
            <div className="flex flex-col items-center border-l border-r border-slate-800 px-2">
              <span className="text-slate-400">Havuz</span>
              <span className="font-bold text-green-400">{Number(roundData.totalEth).toFixed(4)} ETH</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400">Süre</span>
              <span className={`font-bold ${isRoundOver ? 'text-red-400' : 'text-yellow-300'}`}>
                {timeLeftLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-16 w-full bg-slate-900 animate-pulse rounded-xl"></div>
        )}
      </div>

      {/* IZGARA */}
      <div className="relative mb-6">
        <div className="grid grid-cols-5 gap-2 p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
          {Array.from({ length: 25 }).map((_, index) => {
            const stake = roundData?.stakes ? Number(formatEther(roundData.stakes[index])) : 0;
            const isWinner = roundData?.finalized && roundData?.winner === index;
            const isSelected = selectedSquare === index;

            return (
              <button
                key={index}
                onClick={() => !isRoundOver && !roundData?.finalized && setSelectedSquare(index)}
                disabled={isRoundOver || !!roundData?.finalized}
                className={`
                  w-12 h-12 sm:w-14 sm:h-14 rounded-xl relative transition-all duration-200
                  flex flex-col items-center justify-center
                  ${isWinner 
                    ? "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.6)] z-10 scale-110 border-2 border-white" 
                    : isSelected
                      ? "bg-slate-700 border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
                      : "bg-slate-800 hover:bg-slate-700 border border-slate-700/50"}
                `}
              >
                <span className={`absolute top-1 left-1.5 text-[9px] leading-none ${isWinner ? 'text-yellow-900 font-bold' : 'text-slate-600'}`}>
                  {index + 1}
                </span>
                
                {stake > 0 && (
                  <span className={`text-[9px] font-bold mt-1 ${isWinner ? 'text-black' : 'text-green-400'}`}>
                    {stake.toFixed(3)}
                  </span>
                )}

                {isWinner && <span className="absolute -bottom-1 -right-1 text-lg">🏆</span>}
                {!isWinner && isSelected && <span className="absolute bottom-1 right-1 text-xs">⛏️</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* BUTON ALANI */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {/* Duruma göre Buton Değişir */}
        {isRoundOver && !roundData?.finalized ? (
          <button
            onClick={() => handleTransaction('reset')}
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-bold text-lg bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sıfırlanıyor..." : "🔄 Turu Manuel Sıfırla"}
          </button>
        ) : (
          <button
            onClick={() => handleTransaction('deploy')}
            disabled={selectedSquare === null || isLoading || isRoundOver || !!roundData?.finalized}
            className={`
              w-full py-4 rounded-xl font-bold text-lg shadow-lg relative overflow-hidden transition-all active:scale-95
              ${(isRoundOver || roundData?.finalized)
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : selectedSquare === null
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : isLoading
                    ? "bg-yellow-700 text-yellow-200 cursor-wait"
                    : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:shadow-yellow-500/20"}
            `}
          >
            {roundData?.finalized 
              ? "Tur Sona Erdi" 
              : isLoading 
                ? "İşlem Yapılıyor..." 
                : selectedSquare === null 
                  ? "Bir Kare Seçin" 
                  : `KAZI YAP (#${selectedSquare + 1})`}
          </button>
        )}

        {!isRoundOver && !roundData?.finalized && (
          <div className="flex justify-between text-[10px] text-slate-500 px-2 font-mono">
            <span>Giriş: {ENTRY_FEE} ETH</span>
            <span>+ Gas</span>
          </div>
        )}
      </div>

      {/* TRANSACTION SUCCESS */}
      {txHash && (
        <div className="mt-6 w-full max-w-xs bg-green-950/40 border border-green-500/30 rounded-lg p-3 text-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="text-green-400 font-bold text-sm mb-1">✅ İşlem Gönderildi!</div>
          <a 
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-300/60 hover:text-green-200 underline decoration-dotted"
          >
            Explorer'da Görüntüle
          </a>
        </div>
      )}
    </div>
  );
}