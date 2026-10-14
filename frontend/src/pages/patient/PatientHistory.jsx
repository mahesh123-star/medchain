import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function PatientHistory() {
  const { provider, signer } = useWallet();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const myAddress = await signer.getAddress();
        const filterDefs = [
          { name: 'RecordUploaded', f: contract.filters.RecordUploaded(null, myAddress) },
          { name: 'AccessRequested', f: contract.filters.AccessRequested() },
          { name: 'AccessApproved', f: contract.filters.AccessApproved() },
          { name: 'AccessRejected', f: contract.filters.AccessRejected() },
          { name: 'AccessRevoked', f: contract.filters.AccessRevoked() },
          { name: 'RecordAccessed', f: contract.filters.RecordAccessed() },
        ];
        const all = [];
        for (const { name, f } of filterDefs) {
          const evs = await contract.queryFilter(f, 0, 'latest');
          evs.forEach(ev => all.push({
            name,
            args: ev.args,
            hash: ev.transactionHash,
            blockNumber: ev.blockNumber,
          }));
        }
        all.sort((a, b) => b.blockNumber - a.blockNumber);
        setEvents(all);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    if (provider && signer) load();
  }, [provider, signer]);

  const colors = {
    RecordUploaded: 'blue',
    AccessRequested: 'yellow',
    AccessApproved: 'green',
    AccessRejected: 'red',
    AccessRevoked: 'orange',
    RecordAccessed: 'teal',
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Audit Trail</h1>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        ℹ️ The blockchain records permission grants, not file downloads. A granted doctor may or may not have read the file.
      </p>
      {events.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No events recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-start gap-4">
              <div className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 bg-${colors[ev.name] || 'gray'}-400`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{ev.name}</p>
                <p className="text-xs text-slate-400 font-mono truncate">Tx: {ev.hash}</p>
              </div>
              <span className="text-xs text-slate-400">Block #{ev.blockNumber}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
