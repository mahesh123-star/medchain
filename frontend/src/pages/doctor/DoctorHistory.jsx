import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import Spinner from '../../components/Spinner';

export default function DoctorHistory() {
  const { provider, address } = useWallet();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const filters = [
          { name: 'AccessRequested', f: contract.filters.AccessRequested(null, address) },
          { name: 'AccessApproved', f: contract.filters.AccessApproved(null, address) },
          { name: 'AccessRejected', f: contract.filters.AccessRejected(null, address) },
          { name: 'AccessRevoked', f: contract.filters.AccessRevoked(null, address) },
          { name: 'RecordAccessed', f: contract.filters.RecordAccessed(null, address) },
        ];
        const all = [];
        for (const { name, f } of filters) {
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
    if (provider && address) load();
  }, [provider, address]);

  const colors = {
    AccessRequested: 'yellow',
    AccessApproved: 'green',
    AccessRejected: 'red',
    AccessRevoked: 'orange',
    RecordAccessed: 'teal',
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Access History</h1>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        ℹ️ Events reflect permission grants and blockchain transactions, not file reads.
      </p>
      {events.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No events yet.</p>
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
