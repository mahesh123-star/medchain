import React, { useEffect, useState } from 'react';
import { ClipboardList, FileText, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function DoctorOverview() {
  const { provider, address } = useWallet();
  const [reqCount, setReqCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const keys = await contract.getDoctorRequests(address);
        setReqCount(keys.length);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    if (provider && address) load();
  }, [provider, address]);

  const cards = [
    { label: 'My Requests', value: loading ? '...' : reqCount, icon: ClipboardList, color: 'blue', to: '/doctor/requests' },
    { label: 'Search Patients', value: '+', icon: Activity, color: 'teal', to: '/doctor/search' },
    { label: 'Approved Records', value: '→', icon: FileText, color: 'green', to: '/doctor/records' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Doctor Dashboard</h1>
      <p className="text-slate-500 text-sm mb-8">Request and manage access to patient medical records.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link
            key={label}
            to={to}
            className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-${color}-50`}>
              <Icon className={`h-6 w-6 text-${color}-600`} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
