import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { connectWallet, getRole, ROLE } from '../services/web3';
import toast from 'react-hot-toast';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [role, setRole] = useState(ROLE.None);
  const [loading, setLoading] = useState(false);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const result = await connectWallet();
      setProvider(result.provider);
      setSigner(result.signer);
      setAddress(result.address);
      const r = await getRole(result.address, result.provider);
      setRole(r);
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setRole(ROLE.None);
  }, []);

  const refreshRole = useCallback(async (prov, addr) => {
    const p = prov || provider;
    const a = addr || address;
    if (!a || !p) return;
    const r = await getRole(a, p);
    setRole(r);
  }, [address, provider]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else connect();
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [connect, disconnect]);

  return (
    <WalletContext.Provider value={{ address, provider, signer, role, loading, connect, disconnect, refreshRole }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
