// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/MedChain.sol";

/// @notice Deploys MedChain and logs the deployed address.
///         Run:  forge script script/Deploy.s.sol --rpc-url $RPC_URL \
///               --broadcast --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external returns (MedChain medchain) {
        vm.startBroadcast();
        medchain = new MedChain();
        vm.stopBroadcast();

        console.log("MedChain deployed at:", address(medchain));
    }
}
