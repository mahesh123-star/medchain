import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bell, CheckCircle, Upload, RefreshCw } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function PatientOverview() {
  // ✅ Use signer not provider — getMyRecords has onlyPatient modifier
  const { signer, provider, address } = useWallet();
  const [recordCount, setRecordCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const activeContract = signer ? getContract(signer) : getContract(provider);
      // 1. Fetch records count using getPatientRecords(address)
      const records = await activeContract.getPatientRecords(address).catch(async () => {
        if (signer) return await activeContract.getMyRecords();
        return [];
      });
      setRecordCount(records ? records.length : 0);

      // 2. Fetch pending doctor requests
      try {
        const filterReq = activeContract.filters.AccessRequested();
        const reqEvents = await activeContract.queryFilter(filterReq, 0, 'latest');
        let pending = 0;
        const seen = new Set();
        for (const ev of reqEvents) {
          const { recordId, doctor } = ev.args;
          const key = `${recordId}-${doctor}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const meta = await activeContract.getRecordMeta(recordId).catch(() => null);
          if (meta && meta[1].toLowerCase() === address.toLowerCase()) {
            const req = await activeContract.getAccessRequest(recordId, doctor).catch(() => null);
            if (req && Number(req.status) === 1) pending++; // 1 = Pending
          }
        }
        setPendingCount(pending);
      } catch (err) {
        console.warn('Could not count pending requests:', err);
      }

      // 3. Fetch active approved grants
      try {
        const filterApp = activeContract.filters.AccessApproved();
        const appEvents = await activeContract.queryFilter(filterApp, 0, 'latest');
        let approved = 0;
        const seenApp = new Set();
        for (const ev of appEvents) {
          const { recordId, doctor } = ev.args;
          const key = `${recordId}-${doctor}`.toLowerCase();
          if (seenApp.has(key)) continue;
          seenApp.add(key);
          const meta = await activeContract.getRecordMeta(recordId).catch(() => null);
          if (meta && meta[1].toLowerCase() === address.toLowerCase()) {
            const req = await activeContract.getAccessRequest(recordId, doctor).catch(() => null);
            if (req && Number(req.status) === 2) approved++; // 2 = Approved
          }
        }
        setApprovedCount(approved);
      } catch (err) {
        console.warn('Could not count approved grants:', err);
      }
    } catch (err) {
      console.error('Overview load error:', err);
    }
    setLoading(false);
  }, [signer, provider, address]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when a new record is uploaded
  useEffect(() => {
    window.addEventListener('medchain:record-uploaded', load);
    return () => window.removeEventListener('medchain:record-uploaded', load);
  }, [load]);

  const cards = [
    {
      label: 'Total Records',
      value: loading ? '...' : recordCount,
      icon: FileText,
      color: 'blue',
      to: '/patient/records',
    },
    {
      label: 'Upload New Record',
      value: '+',
      icon: Upload,
      color: 'teal',
      to: '/patient/upload',
    },
    {
      label: 'Doctor Requests',
      value: loading ? '...' : pendingCount,
      icon: Bell,
      color: 'yellow',
      to: '/patient/requests',
    },
    {
      label: 'Approved Access',
      value: loading ? '...' : approvedCount,
      icon: CheckCircle,
      color: 'green',
      to: '/patient/approved',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">Patient Dashboard</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-8">Manage your medical records and control access.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
