import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract, ACCESS_STATUS } from '../../services/web3';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function ApprovedAccess() {
  const { provider, signer } = useWallet();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const contract = getContract(provider);
      const myAddress = await signer.getAddress();
      const filter = contract.filters.AccessApproved();
      const events = await contract.queryFilter(filter, 0, 'latest');
      const results = [];
      for (const ev of events) {
        const { recordId, doctor } = ev.args;
        const meta = await contract.getRecordMeta(recordId).catch(() => null);
        if (!meta) continue;
        if (meta[1].toLowerCase() !== myAddress.toLowerCase()) continue;
        const req = await contract.getAccessRequest(recordId, doctor);
        results.push({ recordId, doctor, status: req.status, recordName: meta[2] });
      }
      setGrants(results);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (provider && signer) load();
  }, [provider, signer]);

  const handleRevoke = async () => {
    const { recordId, doctor } = confirm;
    setActing(true);
    try {
      const contract = getContract(signer);
      const tx = await contract.revokeAccess(recordId, doctor);
      await tx.wait();
      toast.success('Access revoked');
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err.shortMessage || err.message || 'Revoke failed');
    }
    setActing(false);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Approved Access</h1>
      <p className="text-slate-500 text-sm mb-6">Manage who currently has access to your records.</p>
      {grants.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grants yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grants.map((g, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{g.recordName}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Doctor: {g.doctor}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={g.status} />
                {Number(g.status) === ACCESS_STATUS.Approved && (
                  <button
                    onClick={() => setConfirm({ recordId: g.recordId, doctor: g.doctor })}
                    className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title="Revoke Access"
        message="This will immediately prevent the doctor from decrypting this record."
        confirmLabel="Revoke"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
