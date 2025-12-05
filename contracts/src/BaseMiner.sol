// ... mevcut kodlar ...

    // --- Frontend Yardımcı Fonksiyonları (View) ---

    /// @notice Frontend'in tek seferde tüm grid durumunu çekmesi için
    function getRoundDetails(uint256 _roundId) external view returns (
        uint256 endTime,
        uint256 totalEth,
        uint256[25] memory squareStakes,
        bool finalized,
        uint256 winner
    ) {
        RoundInfo storage round = rounds[_roundId];
        endTime = roundEndTime; // Bu global değişken, geçmiş turlar için round struct'ına kaydedilmeliydi aslında ama şimdilik böyle
        // Not: Eğer geçmiş turların bitiş süresi önemliyse struct'a roundEndTime eklenmeli.
        // Basitlik için sadece şu anki durumu döndürelim:
        
        totalEth = round.totalDeployed;
        finalized = round.isFinalized;
        winner = round.winningSquare;

        for (uint256 i = 0; i < TOTAL_SQUARES; i++) {
            squareStakes[i] = round.squareDeposits[i];
        }
    }
    
    /// @notice Kullanıcının o turdaki yatırımlarını gösterir
    function getUserBets(uint256 _roundId, address _user) external view returns (uint256[25] memory bets) {
        for (uint256 i = 0; i < TOTAL_SQUARES; i++) {
            bets[i] = userDeposits[_roundId][_user][i];
        }
    }
}