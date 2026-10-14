import React, { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function FindPatient() {
  const { provider, signer } = useWallet();
  const [patientAddr, setPatientAddr] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(null);

  const search = async () => {
    if (!patientAddr.match(/^0x[0-9a-fA-F]{40}$/)) {
      toast.error('Enter a valid Ethereum address');
      return;
    }
    setLoading(true);
    try {
      const contract = getContract(provider);
      const ids = await contract.getPatientRecords(patientAddr);
      const metas = await Promise.all(ids.map(id => contract.getRecordMeta(id)));
      setRecords(metas.map((m, i) => ({
        recordId: ids[i],
        name: m[2],
        uploadedAt: m[3],
      })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch records');
    }
    setLoading(false);
  };

  const requestAccess = async (recordId) => {
    setRequesting(recordId);
    try {
      const contract = getContract(signer);
      const tx = await contract.requestAccess(recordId, 0);
      await tx.wait();
      toast.success('Access request submitted');
    } catch (err) {
      toast.error(err.shortMessage || err.message || 'Request failed');
    }
    setRequesting(null);
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Find Patient</h1>
      <p className="text-slate-500 text-sm mb-6">Enter a patient wallet address to view records and request access.</p>
      <div className="flex gap-2 mb-6">
        <input
          value={patientAddr}
          onChange={e => setPatientAddr(e.target.value)}
          placeholder="0x..."
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      {records.length > 0 && (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.recordId} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-400">{new Date(Number(r.uploadedAt) * 1000).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => requestAccess(r.recordId)}
                disabled={requesting === r.recordId}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
              >
                {requesting === r.recordId ? <Spinner size="sm" /> : 'Request Access'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
