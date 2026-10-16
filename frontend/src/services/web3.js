import { ethers } from 'ethers';
import { MEDCHAIN_ADDRESS, MEDCHAIN_ABI } from '../contracts/MedChainABI';
import { logEvent } from './logger';

const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '31337');

export const ROLE = { None: 0, Patient: 1, Doctor: 2 };
export const ACCESS_STATUS = { None: 0, Pending: 1, Approved: 2, Rejected: 3, Revoked: 4 };

// Human-friendly mapping for Solidity custom errors
const CUSTOM_ERROR_MESSAGES = {
  AlreadyRegistered: 'This wallet is already registered. Redirecting to your dashboard...',
  NotRegistered: 'This wallet is not registered yet. Please register as Patient or Doctor.',
  NotPatient: 'Only registered patients can perform this action.',
  NotDoctor: 'Only registered doctors can perform this action.',
  RecordDoesNotExist: 'The requested medical record does not exist on-chain.',
  NotRecordOwner: 'You are not the owner of this medical record.',
  RequestAlreadyExists: 'An access request for this record already exists.',
  RequestDoesNotExist: 'No access request found for this record and doctor.',
  RequestNotPending: 'This access request is not in pending status.',
  AccessNotApproved: 'Access to this record has not been approved.',
  AccessExpired: 'Access to this record has expired.',
  EmptyString: 'Input parameter cannot be empty.',
  InvalidExpiry: 'Expiry timestamp must be in the future.',
};

/**
 * Checks if MetaMask is already connected (e.g. after page refresh)
 * without popping up a connection prompt.
 */
export async function checkExistingConnection() {
  if (!window.ethereum) return null;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_accounts', []);
    if (!accounts || accounts.length === 0) return null;

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const role = await getRole(address, provider);

    logEvent('INFO', `Restored session for ${address}`, { role });
    return { provider, signer, address, role };
  } catch (err) {
    console.warn('Failed to restore wallet connection:', err);
    return null;
  }
}

/**
 * Explicitly connects MetaMask (prompts user if not already authorized).
 */
export async function connectWallet() {
  if (!window.ethereum) {
    const msg = 'MetaMask not found. Please install MetaMask browser extension.';
    logEvent('ERROR', msg);
    throw new Error(msg);
  }
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
      } else {
        throw e;
      }
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const role = await getRole(address, provider);

  logEvent('SUCCESS', `Connected wallet ${address}`, { chainId: CHAIN_ID, role });
  return { provider, signer, address, role };
}

export function getContract(signerOrProvider) {
  return new ethers.Contract(MEDCHAIN_ADDRESS, MEDCHAIN_ABI, signerOrProvider);
}

export async function getRole(address, provider) {
  try {
    const contract = getContract(provider);
    const role = await contract.roles(address);
    return Number(role);
  } catch (err) {
    console.error('Error fetching role:', err);
    return ROLE.None;
  }
}

export function formatAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

/**
 * Decodes Solidity custom errors and standard contract reverts.
 */
export function parseContractError(err) {
  // Check for decoded custom errors via contract interface
  try {
    const iface = new ethers.Interface(MEDCHAIN_ABI);
    const rawData = err?.data || err?.error?.data || err?.info?.error?.data;
    if (rawData && typeof rawData === 'string') {
      const parsed = iface.parseError(rawData);
      if (parsed && CUSTOM_ERROR_MESSAGES[parsed.name]) {
        return CUSTOM_ERROR_MESSAGES[parsed.name];
      }
    }
  } catch {}

  // Check error message or string details for known custom error names
  const fullErrStr = (err?.message || '') + ' ' + (err?.shortMessage || '') + ' ' + (err?.reason || '');
  for (const [errName, friendlyMsg] of Object.entries(CUSTOM_ERROR_MESSAGES)) {
    if (fullErrStr.includes(errName)) {
      return friendlyMsg;
    }
  }

  if (err?.reason) return err.reason;
  if (err?.shortMessage) return err.shortMessage;
  if (err?.message) {
    if (err.message.includes('user rejected') || err.message.includes('ACTION_REJECTED')) {
      return 'Transaction rejected by user in MetaMask.';
    }
    return err.message.slice(0, 140);
  }
  return 'Unknown transaction error';
}
