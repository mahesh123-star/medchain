import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import { ROLE } from '../../services/web3';
import Sidebar from '../../components/Sidebar';

export default function PatientLayout() {
  const { role } = useWallet();

  // If user switched to doctor or unregistered wallet in MetaMask, redirect immediately
  if (role === ROLE.Doctor) {
    return <Navigate to="/doctor" replace />;
  }
  if (role === ROLE.None) {
    return <Navigate to="/register" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
