import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Upload, FileText, Bell, CheckCircle, History, Stethoscope, Search, ClipboardList, LogOut, Shield, Terminal, RefreshCw, Users } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { ROLE, formatAddress } from '../services/web3';
import toast from 'react-hot-toast';

const patientNav = [
  { to: '/patient', icon: Activity, label: 'Overview', end: true },
  { to: '/patient/upload', icon: Upload, label: 'Upload Record' },
  { to: '/patient/records', icon: FileText, label: 'My Records' },
  { to: '/patient/requests', icon: Bell, label: 'Doctor Requests' },
  { to: '/patient/approved', icon: CheckCircle, label: 'Approved Access' },
  { to: '/patient/history', icon: History, label: 'Audit Trail' },
  { to: '/patient/logs', icon: Terminal, label: 'System Logs' },
];

const doctorNav = [
  { to: '/doctor', icon: Activity, label: 'Overview', end: true },
  { to: '/doctor/search', icon: Search, label: 'Find Patient' },
  { to: '/doctor/requests', icon: ClipboardList, label: 'My Requests' },
  { to: '/doctor/records', icon: FileText, label: 'Approved Records' },
  { to: '/doctor/history', icon: History, label: 'Access History' },
  { to: '/doctor/logs', icon: Terminal, label: 'System Logs' },
];

export default function Sidebar() {
  const { address, role, disconnect, refreshRole, switchAccount } = useWallet();
  const navigate = useNavigate();
  const nav = role === ROLE.Patient ? patientNav : doctorNav;
  const roleLabel = role === ROLE.Patient ? 'Patient' : role === ROLE.Doctor ? 'Doctor' : 'Unregistered';

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const handleRefresh = async () => {
    const r = await refreshRole();
    toast.success(`Role updated: ${r === ROLE.Patient ? 'Patient' : r === ROLE.Doctor ? 'Doctor' : 'Unregistered'}`);
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg text-slate-800">MedChain</span>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh Role & On-Chain State"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">Secure Medical Records</p>
      </div>

      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center ${
              role === ROLE.Patient
                ? 'bg-blue-100 text-blue-600'
                : role === ROLE.Doctor
                ? 'bg-teal-100 text-teal-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {role === ROLE.Patient ? (
              <Activity className="h-4 w-4" />
            ) : (
              <Stethoscope className="h-4 w-4" />
            )}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                role === ROLE.Patient
                  ? 'bg-blue-100 text-blue-700'
                  : role === ROLE.Doctor
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {roleLabel}
            </span>
            <p className="text-xs font-mono text-slate-500 truncate" title={address}>
              {formatAddress(address)}
            </p>
          </div>
        </div>
        <button
          onClick={switchAccount}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 rounded border border-slate-200 transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          <span>Switch Account</span>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Disconnect
        </button>
      </div>
    </aside>
  );
}
