import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract, ACCESS_STATUS } from '../../services/web3';
import { grantKey } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function DoctorRequests() {
  const { provider, signer } = useWallet();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const contract = getContract(provider);
      const myAddress = await signer.getAddress();
      const filter = contract.filters.AccessRequested();
      const events = await contract.queryFilter(filter, 0, 'latest');
      const pending = [];
      for (const ev of events) {
        const { recordId, doctor } = ev.args;
        const meta = await contract.getRecordMeta(recordId).catch(() => null);
        if (!meta) continue;
        const patient = meta[1];
        if (patient.toLowerCase() !== myAddress.toLowerCase()) continue;
        const req = await contract.getAccessRequest(recordId, doctor);
        pending.push({
          recordId,
          doctor,
          status: req.status,
          recordName: meta[2],
          requestedAt: req.requestedAt,
        });
      }
      setRequests(pending);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load requests');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (provider && signer) load();
  }, [provider, signer]);

  const handleApprove = async () => {
    const { recordId, doctor } = confirm;
    setActing(true);
    try {
      await grantKey(recordId.toString(), doctor);
      const contract = getContract(signer);
      const tx = await contract.approveAccess(recordId, doctor, 'backend-key-ref');
      await tx.wait();
      toast.success('Access approved');
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err.shortMessage || err.message || 'Failed to approve');
    }
    setActing(false);
  };

  const handleReject = async () => {
    const { recordId, doctor } = confirm;
    setActing(true);
    try {
      const contract = getContract(signer);
      const tx = await contract.rejectAccess(recordId, doctor);
      await tx.wait();
      toast.success('Rejected');
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err.shortMessage || err.message || 'Failed to reject');
    }
    setActing(false);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Doctor Access Requests</h1>
      <p className="text-slate-500 text-sm mb-6">Review and respond to access requests from doctors.</p>
      {requests.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No access requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{req.recordName}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Doctor: {req.doctor}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(Number(req.requestedAt) * 1000).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </div>
              {Number(req.status) === ACCESS_STATUS.Pending && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setConfirm({ type: 'approve', recordId: req.recordId, doctor: req.doctor })}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setConfirm({ type: 'reject', recordId: req.recordId, doctor: req.doctor })}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirm?.type === 'approve'}
        title="Approve Access"
        message="Grant this doctor access to decrypt the record. You can revoke at any time."
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.type === 'reject'}
        title="Reject Access"
        message="Reject this doctor's request."
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
