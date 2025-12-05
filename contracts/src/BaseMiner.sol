// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Randomness} from "./libraries/Randomness.sol";

/// @title BaseMiner
/// @notice ORE protokolünden esinlenilmiş, Base ağı için Farcaster Frame oyunu.
contract BaseMiner is Ownable, ReentrancyGuard {
    // --- Yapılandırma ---
    uint256 public constant TOTAL_SQUARES = 25; // 5x5 Grid
    uint256 public constant COMMISSION_BPS = 500; // %5 Komisyon (Basis Points: 500/10000)
    uint256 public constant ROUND_DURATION = 1 hours; // Her tur 1 saat

    // --- State (Durum) Değişkenleri ---
    uint256 public roundId;
    uint256 public roundEndTime;
    address public feeCollector; // Sizin cüzdanınız (Komisyon alacak)

    struct RoundInfo {
        uint256 totalDeployed; // O turda yatırılan toplam ETH
        uint256 winningSquare; // Kazanan kare (Tur bitince belirlenir)
        bool isFinalized; // Tur bitti mi?
        mapping(uint256 => uint256) squareDeposits; // Kare başına toplam yatırım
    }

    // roundId => RoundInfo
    mapping(uint256 => RoundInfo) public rounds;

    // roundId => user => squareIndex => amount
    mapping(uint256 => mapping(address => mapping(uint256 => uint256)))
        public userDeposits;

    // --- Eventler (Frontend'in dinleyeceği olaylar) ---
    event Deployed(
        address indexed user,
        uint256 indexed roundId,
        uint256 square,
        uint256 amount
    );
    event RoundEnded(
        uint256 indexed roundId,
        uint256 winningSquare,
        uint256 totalPrize,
        uint256 feeCollected
    );
    event PrizeClaimed(address indexed user, uint256 amount);

    // --- Hatalar ---
    error RoundNotActive();
    error RoundNotEnded();
    error RoundAlreadyFinalized();
    error InvalidSquare();
    error NoDepositFound();
    error TransferFailed();

    constructor(address _feeCollector) Ownable(msg.sender) {
        feeCollector = _feeCollector;
        _startNewRound();
    }

    // --- Kullanıcı Fonksiyonları (Deploy) ---

    /// @notice Kullanıcı bir kareye ETH yatırır.
    /// @param square Seçilen kare (0-24 arası)
    function deploy(uint256 square) external payable nonReentrant {
        if (block.timestamp >= roundEndTime) revert RoundNotActive();
        if (square >= TOTAL_SQUARES) revert InvalidSquare();
        if (msg.value == 0) revert NoDepositFound();

        // Yatırımı kaydet
        userDeposits[roundId][msg.sender][square] += msg.value;
        rounds[roundId].squareDeposits[square] += msg.value;
        rounds[roundId].totalDeployed += msg.value;

        emit Deployed(msg.sender, roundId, square, msg.value);
    }

    // --- Yönetim ve Otomasyon (Reset) ---

    /// @notice Tur süresi dolduğunda bu fonksiyon çağrılır.
    /// @dev Bunu Chainlink Automation veya kendi botumuz çağıracak.
    function reset() external nonReentrant {
        if (block.timestamp < roundEndTime) revert RoundNotEnded();
        if (rounds[roundId].isFinalized) revert RoundAlreadyFinalized();

        // 1. Kazanan Kareyi Belirle (Randomness)
        uint256 winningSquare = Randomness.getRandomNumber(TOTAL_SQUARES);

        // 2. Hesaplamalar
        uint256 totalPool = rounds[roundId].totalDeployed;
        uint256 adminFee = (totalPool * COMMISSION_BPS) / 10000;
        uint256 prizePool = totalPool - adminFee;

        // 3. Durumu Güncelle
        rounds[roundId].winningSquare = winningSquare;
        rounds[roundId].isFinalized = true;

        // 4. Komisyonu Gönder (Sizin Geliriniz)
        if (adminFee > 0) {
            (bool success, ) = feeCollector.call{value: adminFee}("");
            require(success, "Fee transfer failed");
        }

        emit RoundEnded(roundId, winningSquare, prizePool, adminFee);

        // 5. Yeni Turu Başlat
        _startNewRound();
    }

    /// @notice Kazanan kullanıcı ödülünü buradan talep eder.
    /// @param _roundId Hangi turdan ödül alacak?
    function claimReward(uint256 _roundId) external nonReentrant {
        RoundInfo storage round = rounds[_roundId];

        if (!round.isFinalized) revert RoundNotEnded();

        uint256 winningSquare = round.winningSquare;
        uint256 userStaked = userDeposits[_roundId][msg.sender][winningSquare];

        if (userStaked == 0) revert NoDepositFound();

        // Ödül Payı: (Kullanıcının Yatırdığı / O Karedeki Toplam) * Toplam Ödül Havuzu
        // Not: Toplam ödül havuzunu hesaplarken o turdaki admin fee düşülmüş havuzu kullanmalıyız.
        // Basitlik için anlık hesaplıyoruz:
        uint256 totalPool = round.totalDeployed;
        uint256 prizePool = totalPool - ((totalPool * COMMISSION_BPS) / 10000);

        uint256 squareTotalStaked = round.squareDeposits[winningSquare];
        uint256 reward = (userStaked * prizePool) / squareTotalStaked;

        // Bakiyeyi sıfırla (Reentrancy koruması için önce state değişimi)
        userDeposits[_roundId][msg.sender][winningSquare] = 0;

        (bool success, ) = msg.sender.call{value: reward}("");
        if (!success) revert TransferFailed();

        emit PrizeClaimed(msg.sender, reward);
    }

    // --- İç Fonksiyonlar ---

    function _startNewRound() internal {
        roundId++;
        roundEndTime = block.timestamp + ROUND_DURATION;
    }

    // --- Admin Ayarları ---

    function setFeeCollector(address _newCollector) external onlyOwner {
        feeCollector = _newCollector;
    }
}
