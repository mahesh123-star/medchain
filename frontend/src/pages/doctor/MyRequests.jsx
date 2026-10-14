import React, { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';

export default function MyRequests() {
  const { provider, address } = useWallet();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const filter = contract.filters.AccessRequested(null, address);
        const events = await contract.queryFilter(filter, 0, 'latest');
        const results = [];
        for (const ev of events) {
          const { recordId, doctor } = ev.args;
          const req = await contract.getAccessRequest(recordId, doctor);
          const meta = await contract.getRecordMeta(recordId).catch(() => null);
          results.push({
            recordId,
            status: req.status,
            recordName: meta ? meta[2] : 'Unknown',
            patient: meta ? meta[1] : '',
            requestedAt: req.requestedAt,
          });
        }
        setRequests(results);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    if (provider && address) load();
  }, [provider, address]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">My Access Requests</h1>
      <p className="text-slate-500 text-sm mb-6">Track the status of all your access requests.</p>
      {requests.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No requests submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{r.recordName}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Patient: {r.patient}</p>
                <p className="text-xs text-slate-400">
                  {new Date(Number(r.requestedAt) * 1000).toLocaleString()}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
