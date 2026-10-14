import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bell, CheckCircle, Upload } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function PatientOverview() {
  const { provider } = useWallet();
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const records = await contract.getMyRecords();
        setRecordCount(records.length);
      } catch {}
      setLoading(false);
    };
    if (provider) load();
  }, [provider]);

  const cards = [
    { label: 'Total Records', value: loading ? '...' : recordCount, icon: FileText, color: 'blue', to: '/patient/records' },
    { label: 'Upload New Record', value: '+', icon: Upload, color: 'teal', to: '/patient/upload' },
    { label: 'Doctor Requests', value: '→', icon: Bell, color: 'yellow', to: '/patient/requests' },
    { label: 'Approved Access', value: '→', icon: CheckCircle, color: 'green', to: '/patient/approved' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Patient Dashboard</h1>
      <p className="text-slate-500 text-sm mb-8">Manage your medical records and control access.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center justify-between">
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
