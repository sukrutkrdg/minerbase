import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts"; // DÜZELTME 1: Doğru import yolu
import { baseSepolia } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// Private key kontrolü (Hata almamak için)
if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY .env dosyasında bulunamadı!");
}

const ACCOUNT = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Kontrat adresi (Page.tsx ile aynı olmalı)
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; 

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL)
});

const wallet = createWalletClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
  account: ACCOUNT
});

const ABI = [
  {
    name: "roundEndTime",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "reset",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

async function checkAndReset() {
  console.log("Bot: Kontrol ediliyor...");
  try {
    const endTime = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "roundEndTime"
    });

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Number(endTime) - now;

    console.log(`Tur bitimine kalan süre: ${timeLeft} saniye`);

    if (timeLeft <= 0) {
      console.log("Süre doldu! Reset işlemi başlatılıyor...");
      const hash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "reset",
        account: ACCOUNT // DÜZELTME 2: Account parametresi eklendi
      });
      console.log(`Reset TX gönderildi: ${hash}`);
    }
  } catch (error) {
    console.error("Hata:", error);
  }
}

// Her 1 dakikada bir kontrol et
setInterval(checkAndReset, 60 * 1000);
console.log("BaseMiner Bot Başlatıldı 🤖");