import React, { useEffect, useState } from 'react';
import { FileText, Calendar } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function MyRecords() {
  const { provider } = useWallet();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const ids = await contract.getMyRecords();
        const details = await Promise.all(ids.map(id => contract.getRecord(id)));
        setRecords(details);
      } catch (err) {
        console.error('Failed to load my records:', err);
      }
      setLoading(false);
    };
    if (provider) load();
  }, [provider]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">My Medical Records</h1>
      <p className="text-slate-500 text-sm mb-6">{records.length} record{records.length !== 1 ? 's' : ''}</p>
      {records.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No records yet. <a href="/patient/upload" className="text-blue-600 hover:underline">Upload one</a></p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.recordId} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
              <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{r.recordName}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(Number(r.uploadedAt) * 1000).toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">CID: {r.ipfsCid}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
