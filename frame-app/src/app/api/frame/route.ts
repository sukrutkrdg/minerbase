import { NextRequest, NextResponse } from 'next/server';
import { getFrameMessage, getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { encodeFunctionData, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains'; // Test için Sepolia, canlı için 'base' kullanacağız

// Kontratın ABI'si (Sadece idddddddddddddddddddddddhtiyacımız olan fonksiyonlar)
const CONTRACT_ABI = [
  {
    "type": "function",
    "name": "deploy",
    "inputs": [{ "name": "square", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "payable"
  }
] as const;

// DEPLOY ETTİĞİN KONTRAT ADRESİNİ BUdddddddddRAYA YAZMALISIN!
const CONTRACT_ADDRESS = "0xb68bC7FEDf18c5cF41b39ff75ecD9c04C1164244"; // Deploy sonrası terminalden aldığın adres

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  
  // Farcaster mesajını doğrula
  const { isValid, message } = await getFrameMessage(body, { neynarApiKey: 'NEYNAR_ONCHAIN_KIT' });

  if (!isValid) {
    return new NextResponse('Message not valid', { status: 500 });
  }

  // Kullanıcının girdiği metni (kare numarası) alalım. 
  // Not: Basitlik için şu an text input kullanıyoruz, ileride butonlarla da yapılabilir.
  // Frame butonuna basıldığında bu çalışacak.
  
  // Örnek: Kullanıcı 5. kareye oynamak istiyor.
  // Gerçek senaryoda kare seçimini input'tan veya buton indexinden alabiliriz.
  const squareToPlay = 0; // Şimdilik 0. kareye sabitliyoruz veya random seçtirebiliriz.
  
  // Yatırılacak Miktar (Örn: 0.0001 ETH)
  const deployAmount = parseEther('0.0001');

  // Transaction Verisini Oluştur
  const data = encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'deploy',
    args: [BigInt(squareToPlay)]
  });

  // OnchainKit ile Transaction Yanıtı Döndür
  // Bu özellik Farcaster'ın yeni "Transaction Frame" özelliğidir.
  return NextResponse.json({
    chainId: `eip155:${baseSepolia.id}`, // Base Mainnet için: base.id
    method: 'eth_sendTransaction',
    params: {
      abi: CONTRACT_ABI,
      to: CONTRACT_ADDRESS,
      data: data,
      value: deployAmount.toString(),
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return new NextResponse('Bu endpoint sadece POST kabul eder.');
}