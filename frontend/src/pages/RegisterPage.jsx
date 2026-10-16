import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, Stethoscope } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { getContract, formatAddress, parseContractError, sendWithCorrectNonce, ROLE } from '../services/web3';
import { logEvent } from '../services/logger';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { signer, address, role, refreshRole, provider } = useWallet();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If the wallet is already registered, redirect immediately to their dashboard
  useEffect(() => {
    if (role === ROLE.Patient) {
      navigate('/patient', { replace: true });
    } else if (role === ROLE.Doctor) {
      navigate('/doctor', { replace: true });
    }
  }, [role, navigate]);

  const register = async (asDoctor) => {
    setLoading(true);
    const chosenRoleName = asDoctor ? 'Doctor' : 'Patient';
    logEvent('INFO', `Attempting registration as ${chosenRoleName} for ${address}`);

    try {
      const contract = getContract(signer);
      const tx = await sendWithCorrectNonce(signer, (overrides) =>
        asDoctor ? contract.registerAsDoctor(overrides) : contract.registerAsPatient(overrides)
      );
      toast.loading('Confirming transaction on blockchain...', { id: 'reg' });
      await tx.wait();
      toast.success(`Registered successfully as ${chosenRoleName}!`, { id: 'reg' });
      logEvent('SUCCESS', `Successfully registered as ${chosenRoleName} for ${address}`, { txHash: tx.hash });
      await refreshRole(provider, address);
      navigate(asDoctor ? '/doctor' : '/patient', { replace: true });
    } catch (err) {
      const friendlyError = parseContractError(err);
      toast.error(friendlyError, { id: 'reg', duration: 5000 });
      logEvent('ERROR', `Registration failed for ${address}: ${friendlyError}`, err);

      // If the contract says already registered, refresh role and redirect
      if (friendlyError.toLowerCase().includes('already registered')) {
        setTimeout(async () => {
          const updatedRole = await refreshRole(provider, address);
          if (updatedRole === ROLE.Patient) navigate('/patient', { replace: true });
          else if (updatedRole === ROLE.Doctor) navigate('/doctor', { replace: true });
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">MedChain</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Choose Your Role</h2>
        <p className="text-slate-500 text-sm mb-2">
          Connected as <span className="font-mono text-blue-600">{formatAddress(address)}</span>
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
          This choice is permanent for this wallet address on the blockchain.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => register(false)}
            disabled={loading}
            className="flex flex-col items-center gap-3 p-6 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <Activity className="h-10 w-10 text-blue-600" />
            <div className="text-center">
              <p className="font-semibold text-slate-800">Patient</p>
              <p className="text-xs text-slate-500">Upload and manage your medical records</p>
            </div>
          </button>

          <button
            onClick={() => register(true)}
            disabled={loading}
            className="flex flex-col items-center gap-3 p-6 border-2 border-teal-200 hover:border-teal-500 hover:bg-teal-50 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <Stethoscope className="h-10 w-10 text-teal-600" />
            <div className="text-center">
              <p className="font-semibold text-slate-800">Doctor</p>
              <p className="text-xs text-slate-500">Request access to patient records</p>
            </div>
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center mt-6 gap-2">
            <Spinner />
            <p className="text-xs text-slate-500">Confirming in MetaMask...</p>
          </div>
        )}
      </div>
    </div>
  );
}
