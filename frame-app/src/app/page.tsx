"use client";

import { useState, useEffect } from 'react';

// --- SABİTLER VE AYARLAR ---

// 1. Kontrat Adresinizi buraya girin
const CONTRACT_ADDRESS = "0xYOUR_CONTRACT_ADDRESS_HERE"; 

// 2. Basit ABI
const CONTRACT_ABI = [
  "function dig(uint256 x, uint256 y) external",
  "function getBoard() external view returns (uint8[5][5] memory)",
  "event Dig(address indexed player, uint256 x, uint256 y, bool isBomb)"
];

export default function Home() {
  // State tanımları - ethers nesneleri için 'any' veya genel tipler kullanıyoruz çünkü CDN'den yüklenecek
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [address, setAddress] = useState<string>("");
  
  // Kütüphane yükleme durumu
  const [isEthersLoaded, setIsEthersLoaded] = useState(false);
  
  // Oyun Durumu
  // 0: Kapalı, 1: Boş/Güvenli, 2: Bomba
  const [board, setBoard] = useState<number[][]>(Array(5).fill(Array(5).fill(0)));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Kütüphaneler yükleniyor...");

  // Ethers.js kütüphanesini CDN üzerinden yükle
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.11.1/ethers.umd.min.js";
    script.async = true;
    script.onload = () => {
      setIsEthersLoaded(true);
      setStatus("Cüzdan Bağlanmadı");
    };
    script.onerror = () => {
      setStatus("Hata: Ethers kütüphanesi yüklenemedi.");
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Cüzdan Bağlantısı
  const connectWallet = async () => {
    if (!isEthersLoaded) {
      setStatus("Kütüphane henüz yüklenmedi, lütfen bekleyin.");
      return;
    }
    
    // Window üzerinden ethers erişimi
    const ethers = (window as any).ethers;

    if (!(window as any).ethereum) {
      setStatus("Lütfen Metamask veya uyumlu bir cüzdan yükleyin.");
      return;
    }

    try {
      setLoading(true);
      // Base Ağına Geçiş İsteği
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // Base Mainnet ID (8453 in hex)
        });
      } catch (switchError: any) {
        console.log("Ağ değiştirilemedi veya kullanıcı reddetti.");
      }

      const _provider = new ethers.BrowserProvider((window as any).ethereum);
      const _signer = await _provider.getSigner();
      const _address = await _signer.getAddress();
      
      // Kontrat örneği oluştur
      const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);

      setProvider(_provider);
      setSigner(_signer);
      setAddress(_address);
      setContract(_contract);
      setStatus("Bağlandı: Hazır");
      
    } catch (error) {
      console.error("Bağlantı hatası:", error);
      setStatus("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // --- KRİTİK İYİLEŞTİRME 1 & 2 ---
  const handleDig = async (rowIndex: number, colIndex: number) => {
    if (!contract || !signer) {
      setStatus("Lütfen önce cüzdan bağlayın.");
      return;
    }

    // İYİLEŞTİRME 1: Dolu Kare Engeli
    // Eğer yerel state'te burası zaten açılmış görünüyorsa işlemi durdur.
    if (board[rowIndex][colIndex] !== 0) {
        console.log("Bu kare zaten kazılmış.");
        return; 
    }

    try {
      setLoading(true);
      setStatus("İşlem onaylanıyor...");

      // İYİLEŞTİRME 2: Manuel Gaz Limiti
      // RPC hatalarını ve 'cannot estimate gas' hatalarını bypass eder.
      // ethers v6 syntax'ı kullanıyoruz
      const tx = await contract.dig(rowIndex, colIndex, {
        gasLimit: 300000 // Sabit gaz limiti (Base için genellikle yeterli)
      });

      setStatus("İşlem gönderildi, madencilik bekleniyor...");
      
      await tx.wait(); // İşlemin bloklanmasını bekle

      setStatus("Kazma başarılı!");
      
      // Başarılı işlemden sonra hücreyi yerel olarak güncelle
      const newBoard = board.map(row => [...row]);
      newBoard[rowIndex][colIndex] = 1; // Geçici olarak 'açıldı' (elmas) olarak işaretle
      setBoard(newBoard);

    } catch (error: any) {
      console.error("Kazma hatası:", error);
      
      // Kullanıcı dostu hata mesajları
      if (error.code === 'ACTION_REJECTED') {
        setStatus("İşlemi reddettiniz.");
      } else if (error.message && error.message.includes("taken")) {
        setStatus("Hata: Bu kare zaten alınmış!");
      } else {
        setStatus(`Hata: ${error.reason || (error.info ? error.info.error.message : error.message) || "İşlem hatası"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Basit 5x5 Grid Render
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        
        {/* Başlık */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-500">Base Minesweeper</h1>
          <p className="mt-2 text-gray-400">Mayınları bul, ödülleri kazan.</p>
        </div>

        {/* Durum Paneli */}
        <div className="rounded-lg bg-gray-800 p-4 text-center border border-gray-700">
          <p className={`text-sm font-mono ${status.includes("Hata") ? "text-red-400" : "text-green-400"}`}>
            {status}
          </p>
          {!address && (
            <button
              onClick={connectWallet}
              disabled={loading || !isEthersLoaded}
              className="mt-3 w-full rounded bg-blue-600 px-4 py-2 font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Bağlanıyor..." : (!isEthersLoaded ? "Yükleniyor..." : "Cüzdanı Bağla")}
            </button>
          )}
          {address && (
             <p className="mt-2 text-xs text-gray-500 truncate">Hesap: {address}</p>
          )}
        </div>

        {/* Oyun Tahtası */}
        <div className="grid grid-cols-5 gap-2 bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
          {board.map((row, rIndex) => (
            row.map((cell, cIndex) => (
              <button
                key={`${rIndex}-${cIndex}`}
                onClick={() => handleDig(rIndex, cIndex)}
                disabled={loading || cell !== 0} // Doluysa veya yükleniyorsa disable et
                className={`
                  aspect-square w-full rounded-md text-2xl font-bold transition-all duration-200
                  ${cell === 0 
                    ? "bg-gray-600 hover:bg-gray-500 active:scale-95" 
                    : cell === 1 
                      ? "bg-green-600 cursor-default shadow-inner" 
                      : "bg-red-600 cursor-default"
                  }
                  ${loading ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {cell === 0 ? "" : cell === 1 ? "💎" : "💣"}
              </button>
            ))
          ))}
        </div>
        
        <div className="text-xs text-center text-gray-500">
            Base Mainnet • Gas Limit: 300k
        </div>

      </div>
    </main>
  );
}