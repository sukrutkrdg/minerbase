// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {BaseMiner} from "../src/BaseMiner.sol";

contract DeployBaseMiner is Script {
    function run() external {
        // .env dosyasından PRIVATE_KEY ve FEE_COLLECTOR adresini okuyoruz
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");

        // Yayını başlat (Bundan sonraki işlemler gerçek cüzdanla yapılır)
        vm.startBroadcast(deployerPrivateKey);

        // BaseMiner kontratını deploy et
        BaseMiner miner = new BaseMiner(feeCollector);

        console.log("BaseMiner deployed at:", address(miner));
        console.log("Fee Collector set to:", feeCollector);

        vm.stopBroadcast();
    }
}
