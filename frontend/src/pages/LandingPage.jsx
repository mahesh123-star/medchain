import React from 'react';
import { Shield, Lock, Brain, Activity } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import Spinner from '../components/Spinner';

const features = [
  { icon: Shield, title: 'Blockchain Ownership', desc: 'Your records are owned by your wallet. Smart contracts enforce every access decision.' },
  { icon: Lock, title: 'AES-256 Encryption', desc: 'Files are encrypted before upload. Only authorised doctors receive the decryption key.' },
  { icon: Brain, title: 'AI Summarisation', desc: 'Get an instant structured summary of any authorised medical report.' },
  { icon: Activity, title: 'Full Audit Trail', desc: 'Every access request, approval, and revocation is recorded on-chain.' },
];

export default function LandingPage() {
  const { connect, loading } = useWallet();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-blue-100 bg-white/70">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-blue-600" />
          <span className="font-bold text-xl text-slate-800">MedChain</span>
        </div>
        <button onClick={connect} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
          {loading && <Spinner size="sm" />}
          Connect MetaMask
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <h1 className="text-5xl font-bold text-slate-800 mb-4 max-w-2xl leading-tight">Secure Medical Record Sharing on the Blockchain</h1>
        <p className="text-slate-500 text-lg max-w-xl mb-10">Patients control access. Doctors request permission. Every action is auditable and tamper-proof.</p>
        <button onClick={connect} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-base font-medium transition-colors disabled:opacity-60 mb-3">
          {loading ? <Spinner size="sm" /> : <Shield className="h-5 w-5" />}
          Get Started with MetaMask
        </button>
        <p className="text-xs text-slate-400">Academic prototype — uses synthetic medical records only</p>
      </main>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-8 pb-16 max-w-6xl mx-auto w-full">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
            <p className="text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
