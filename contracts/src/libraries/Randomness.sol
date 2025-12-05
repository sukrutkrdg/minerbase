// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

library Randomness {
    /// @notice ORE mantığına benzer şekilde, önceki bloğun hash'ini kullanarak rastgelelik üretir.
    /// @dev Base gibi L2'lerde block.prevrandao veya blockhash kullanılır.
    function getRandomNumber(uint256 max) internal view returns (uint256) {
        // Blok zorluğu, zaman damgası ve önceki blok hash'inden karma bir seed oluşturuyoruz.
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao, // Ethereum/Base'de rastgelelik için
                    blockhash(block.number - 1)
                )
            )
        );

        return seed % max;
    }
}
