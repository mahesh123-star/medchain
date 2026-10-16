import React, { useEffect, useState } from 'react';
import { FileText, Download, Brain } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import { retrieveEncryptedFile, retrieveKey, summarizeReport } from '../../services/api';
import { decryptData } from '../../services/crypto';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

export default function ApprovedRecords() {
  const { provider, signer, address } = useWallet();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [summarizing, setSummarizing] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const contract = getContract(provider);
        const filter = contract.filters.AccessApproved(null, address);
        const events = await contract.queryFilter(filter, 0, 'latest');
        const results = [];
        for (const ev of events) {
          const { recordId } = ev.args;
          const hasAccess = await contract.hasActiveAccess(recordId, address);
          const meta = await contract.getRecordMeta(recordId).catch(() => null);
          if (!meta) continue;
          results.push({ recordId, name: meta[2], patient: meta[1], hasAccess });
        }
        setRecords(results);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    if (provider && address) load();
  }, [provider, address]);

  const openRecord = async (rec) => {
    setDecrypting(rec.recordId);
    try {
      const contract = getContract(signer);
      const fullRec = await contract.getRecord(rec.recordId);
      const logTx = await contract.logAccess(rec.recordId);
      await logTx.wait();

      const encryptedBuffer = await retrieveEncryptedFile(fullRec.ipfsCid);
      const { aes_key_b64, iv_b64 } = await retrieveKey(rec.recordId.toString(), address);
      const decryptedBytes = await decryptData(new Uint8Array(encryptedBuffer), aes_key_b64, iv_b64);

      const blob = new Blob([decryptedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rec.name + '.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Record decrypted and downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to open record');
    }
    setDecrypting(null);
  };

  const uint8ArrayToBase64 = (bytes) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
    }
    return btoa(binary);
  };

  const getAISummary = async (rec) => {
    setSummarizing(rec.recordId);
    try {
      const contract = getContract(signer);
      const fullRec = await contract.getRecord(rec.recordId);
      const encryptedBuffer = await retrieveEncryptedFile(fullRec.ipfsCid);
      const { aes_key_b64, iv_b64 } = await retrieveKey(rec.recordId.toString(), address);
      const decryptedBytes = await decryptData(new Uint8Array(encryptedBuffer), aes_key_b64, iv_b64);

      // Convert clean decrypted PDF bytes to base64 so PyPDF extracts text accurately
      const pdfBase64 = uint8ArrayToBase64(decryptedBytes);
      const result = await summarizeReport('', pdfBase64);
      setSummaries(prev => ({ ...prev, [rec.recordId]: result.summary }));
      toast.success('Clinical summary generated in words');
    } catch (err) {
      toast.error(err.message || 'AI summary failed');
    }
    setSummarizing(null);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Approved Records</h1>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        ⚕️ AI-generated summaries are for informational assistance only and are not a substitute for clinical judgment.
      </p>
      {records.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No approved records yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(rec => (
            <div key={rec.recordId} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{rec.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Patient: {rec.patient}</p>
                  {!rec.hasAccess && <p className="text-xs text-red-500 mt-1">Access expired or revoked</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openRecord(rec)}
                    disabled={!rec.hasAccess || decrypting === rec.recordId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    {decrypting === rec.recordId ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" />} Open
                  </button>
                  <button
                    onClick={() => getAISummary(rec)}
                    disabled={!rec.hasAccess || summarizing === rec.recordId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    {summarizing === rec.recordId ? <Spinner size="sm" /> : <Brain className="h-3.5 w-3.5" />} AI Summary
                  </button>
                </div>
              </div>
              {summaries[rec.recordId] && (
                <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                  <p className="text-xs font-semibold text-teal-700 mb-2">AI Summary</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{summaries[rec.recordId]}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    ⚕️ For informational assistance only. Not a substitute for clinical judgment.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
