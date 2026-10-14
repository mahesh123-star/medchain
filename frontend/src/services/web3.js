import { ethers } from 'ethers';
import { MEDCHAIN_ADDRESS, MEDCHAIN_ABI } from '../contracts/MedChainABI';

const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '31337');

export const ROLE = { None: 0, Patient: 1, Doctor: 2 };
export const ACCESS_STATUS = { None: 0, Pending: 1, Approved: 2, Rejected: 3, Revoked: 4 };

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
      });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + CHAIN_ID.toString(16),
            chainName: 'Anvil Local',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        });
      } else throw e;
    }
  }
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

export function getContract(signerOrProvider) {
  return new ethers.Contract(MEDCHAIN_ADDRESS, MEDCHAIN_ABI, signerOrProvider);
}

export async function getRole(address, provider) {
  const contract = getContract(provider);
  const role = await contract.roles(address);
  return Number(role);
}

export function formatAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function parseContractError(err) {
  if (err?.reason) return err.reason;
  if (err?.shortMessage) return err.shortMessage;
  if (err?.message) {
    if (err.message.includes('user rejected')) return 'Transaction rejected by user';
    return err.message.slice(0, 120);
  }
  return 'Unknown error';
}
