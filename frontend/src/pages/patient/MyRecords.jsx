import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Calendar, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import { logEvent } from '../../services/logger';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function MyRecords() {
  // ✅ FIX 1: Use `signer` instead of `provider` so getMyRecords (onlyPatient) works
  const { signer, address } = useWallet();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ FIX 2: Wrap load in useCallback so it can be called manually (refresh button)
  const load = useCallback(async () => {
    if (!signer || !address) return;
    setLoading(true);
    setError(null);
    try {
      // Use signer so the contract call comes from the patient's address
      const contract = getContract(signer);

      // getMyRecords() uses onlyPatient modifier — must be called with signer
      const ids = await contract.getMyRecords();

      if (!ids || ids.length === 0) {
        setRecords([]);
        logEvent('INFO', `No records found for ${address}`);
        return;
      }

      // ✅ FIX 3: Fetch records one by one, skip any that error instead of failing all
      const details = [];
      for (const id of ids) {
        try {
          const rec = await contract.getRecord(id);
          // Also fetch meta as fallback in case getRecord fails
          details.push({
            recordId: rec.recordId,
            recordName: rec.recordName,
            ipfsCid: rec.ipfsCid,
            uploadedAt: rec.uploadedAt,
          });
        } catch (recErr) {
          console.warn('Could not fetch record', id, recErr);
          // Fallback: use getRecordMeta which is public and doesn't require ownership check
          try {
            const meta = await contract.getRecordMeta(id);
            details.push({
              recordId: id,
              recordName: meta[2],
              ipfsCid: '(encrypted — access via dashboard)',
              uploadedAt: meta[3],
            });
          } catch {}
        }
      }

      // ✅ FIX 4: Sort newest first
      details.sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt));
      setRecords(details);
      logEvent('INFO', `Loaded ${details.length} records for ${address}`);
    } catch (err) {
      console.error('Failed to load records:', err);
      const msg = err?.shortMessage || err?.message || 'Failed to load records';
      setError(msg);
      logEvent('ERROR', `Failed to load records: ${msg}`, err);
      toast.error('Could not load records. Are your services running?');
    } finally {
      setLoading(false);
    }
  }, [signer, address]);

  // ✅ FIX 5: Reload whenever address changes (account switch) OR when component mounts
  useEffect(() => {
    load();
  }, [load]);

  // ✅ FIX 6: Also listen for the custom event fired by UploadRecord after a successful upload
  useEffect(() => {
    const handleUploaded = () => {
      logEvent('INFO', 'New record detected — refreshing My Records...');
      load();
    };
    window.addEventListener('medchain:record-uploaded', handleUploaded);
    return () => window.removeEventListener('medchain:record-uploaded', handleUploaded);
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">My Medical Records</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="text-slate-500 text-sm mb-6">
        {loading ? 'Loading...' : `${records.length} record${records.length !== 1 ? 's' : ''} found for your wallet`}
      </p>

      {/* Error state */}
      {error && !loading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {error}
          <button onClick={load} className="ml-3 underline text-red-600 font-medium">Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Fetching your records from the blockchain...</p>
        </div>
      ) : records.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">No records uploaded yet</p>
          <p className="text-sm mb-4">Upload your first medical document to get started.</p>
          <Link
            to="/patient/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Upload Record <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        /* Records list */
        <div className="space-y-3">
          {records.map((r, idx) => (
            <div
              key={r.recordId?.toString() || idx}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{r.recordName}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(Number(r.uploadedAt) * 1000).toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                  CID: {r.ipfsCid}
                </p>
                <p className="text-xs text-slate-300 font-mono truncate mt-0.5">
                  ID: {r.recordId?.toString()?.slice(0, 20)}...
                </p>
              </div>
              <span className="flex-shrink-0 text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium border border-green-100">
                Encrypted
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
