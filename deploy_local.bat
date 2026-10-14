@echo off
echo ========================================================
echo Deploying MedChain to Local Anvil (Chain ID: 31337)
echo ========================================================
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
pause
