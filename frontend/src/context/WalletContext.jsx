import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { connectWallet, checkExistingConnection, getRole, ROLE } from '../services/web3';
import { logEvent } from '../services/logger';
import toast from 'react-hot-toast';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [role, setRole] = useState(ROLE.None);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore connection automatically on page load/refresh
  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        const session = await checkExistingConnection();
        if (mounted && session) {
          setProvider(session.provider);
          setSigner(session.signer);
          setAddress(session.address);
          setRole(session.role);
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const result = await connectWallet();
      // Set all states together to avoid intermediate renders with role = None
      setProvider(result.provider);
      setSigner(result.signer);
      setAddress(result.address);
      setRole(result.role);
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    logEvent('INFO', `User disconnected wallet ${address || ''}`);
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setRole(ROLE.None);
  }, [address]);

  const refreshRole = useCallback(async (prov, addr) => {
    const p = prov || provider;
    const a = addr || address;
    if (!a || !p) return;
    const r = await getRole(a, p);
    setRole(r);
    logEvent('INFO', `Role refreshed for ${a}: ${r === ROLE.Patient ? 'Patient' : r === ROLE.Doctor ? 'Doctor' : 'None'}`);
    return r;
  }, [address, provider]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        disconnect();
      } else {
        const newAddr = accounts[0];
        logEvent('INFO', `MetaMask account switched to ${newAddr}`);
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const role = await getRole(address, provider);

          setProvider(provider);
          setSigner(signer);
          setAddress(address);
          setRole(role);

          const roleName = role === ROLE.Doctor ? 'Doctor' : role === ROLE.Patient ? 'Patient' : 'Unregistered';
          toast.success(`Switched to ${roleName} account (${address.slice(0, 6)}...${address.slice(-4)})`, { id: 'acct-switch' });
        } catch (err) {
          console.error('Error switching account:', err);
          await connect();
        }
      }
    };

    const handleChainChanged = () => {
      logEvent('INFO', 'MetaMask network changed. Reloading page...');
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [connect, disconnect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        provider,
        signer,
        role,
        loading,
        isInitializing,
        connect,
        disconnect,
        refreshRole,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
