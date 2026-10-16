import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Upload, FileText, Bell, CheckCircle, History, Stethoscope, Search, ClipboardList, LogOut, Shield, Terminal } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { ROLE, formatAddress } from '../services/web3';

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
  const { address, role, disconnect } = useWallet();
  const navigate = useNavigate();
  const nav = role === ROLE.Patient ? patientNav : doctorNav;
  const roleLabel = role === ROLE.Patient ? 'Patient' : 'Doctor';

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg text-slate-800">MedChain</span>
        </div>
        <p className="text-xs text-slate-500">Secure Medical Records</p>
      </div>

      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            {role === ROLE.Patient ? (
              <Activity className="h-4 w-4 text-blue-600" />
            ) : (
              <Stethoscope className="h-4 w-4 text-teal-600" />
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-slate-700">{roleLabel}</p>
            <p className="text-xs text-slate-400 truncate">{formatAddress(address)}</p>
          </div>
        </div>
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
