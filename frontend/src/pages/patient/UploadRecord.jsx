import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import { getContract, parseContractError, sendWithCorrectNonce } from '../../services/web3';
import { generateKeyAndIV, encryptFile } from '../../services/crypto';
import { uploadEncryptedFile, storeKey } from '../../services/api';
import { logEvent } from '../../services/logger';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export default function UploadRecord() {
  const { signer } = useWallet();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [recordName, setRecordName] = useState('');
  const [step, setStep] = useState('idle');
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const addProgress = (msg, status = 'done') => {
    setProgress(prev => [...prev, { msg, status, ts: new Date().toLocaleTimeString() }]);
  };

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Only PDF files are supported.'); return; }
    if (f.size > MAX_SIZE) { toast.error('File too large (max 10 MB).'); return; }
    setFile(f);
    if (!recordName) setRecordName(f.name.replace('.pdf', ''));
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  const handleUpload = async () => {
    if (!file || !recordName.trim()) { toast.error('Select a file and enter a record name.'); return; }
    if (!signer) { toast.error('Wallet not connected. Please reconnect MetaMask.'); return; }

    setProgress([]);
    try {
      // Step 1: Encrypt
      setStep('encrypting');
      addProgress('Generating AES-256-GCM key and IV in browser...', 'active');
      const { key, iv, keyB64, ivB64 } = await generateKeyAndIV();
      addProgress('File encrypted with AES-256-GCM (client-side only)');
      const encryptedBytes = await encryptFile(file, key, iv);
      logEvent('INFO', `Encrypted file "${file.name}" (${file.size} bytes)`);

      // Step 2: Upload to IPFS
      setStep('uploading');
      addProgress('Uploading encrypted bytes to IPFS via backend...', 'active');
      const { cid, mode } = await uploadEncryptedFile(encryptedBytes, recordName);
      addProgress(`Pinned to IPFS — CID: ${cid.slice(0, 20)}... [${mode}]`);
      logEvent('SUCCESS', `Uploaded to IPFS, CID: ${cid}`, { mode });

      // Step 3: Register on blockchain
      setStep('registering');
      addProgress('Registering record on blockchain (confirm MetaMask)...', 'active');
      const contract = getContract(signer);
      const tx = await sendWithCorrectNonce(signer, (overrides) =>
        contract.uploadRecord(cid, recordName, overrides)
      );
      addProgress('Transaction submitted, waiting for confirmation...');
      const receipt = await tx.wait();

      // Parse recordId from event logs
      const event = receipt.logs
        .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
        .find(e => e && e.name === 'RecordUploaded');
      const recordId = event?.args?.recordId;

      if (!recordId) {
        throw new Error('Could not extract record ID from transaction receipt. Upload may still have succeeded — check My Records.');
      }

      addProgress(`Confirmed on-chain! Record ID: ${recordId.toString().slice(0, 20)}...`);
      logEvent('SUCCESS', `Record "${recordName}" registered on blockchain`, { cid, txHash: receipt.hash, recordId: recordId.toString() });

      // Step 4: Store AES key on backend
      setStep('storing-key');
      addProgress('Storing encrypted AES key on backend...', 'active');
      await storeKey(recordId.toString(), keyB64, ivB64);
      addProgress('AES key securely wrapped and stored');
      logEvent('INFO', `AES key stored for record ${recordId.toString().slice(0, 10)}...`);

      // Finish
      setResult({ cid, recordId: recordId.toString(), txHash: receipt.hash, recordName });
      setStep('done');
      toast.success(`"${recordName}" uploaded and registered!`);

      // ✅ Fire global event so MyRecords refreshes automatically
      window.dispatchEvent(new CustomEvent('medchain:record-uploaded', { detail: { recordId: recordId.toString(), cid } }));

    } catch (err) {
      const msg = parseContractError(err);
      addProgress(`❌ Error: ${msg}`, 'error');
      logEvent('ERROR', `Upload failed: ${msg}`, err);
      toast.error(msg);
      setStep('idle');
    }
  };

  const reset = () => {
    setFile(null);
    setRecordName('');
    setStep('idle');
    setResult(null);
    setProgress([]);
  };

  const busy = ['encrypting', 'uploading', 'registering', 'storing-key'].includes(step);

  const stepLabel = {
    encrypting: 'Encrypting file in browser...',
    uploading: 'Uploading to IPFS...',
    registering: 'Registering on blockchain...',
    'storing-key': 'Storing encryption key...',
  }[step] || '';

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Upload Medical Record</h1>
      <p className="text-slate-500 text-sm mb-6">
        Files are AES-256-GCM encrypted in your browser before uploading to IPFS.
      </p>

      {step === 'done' && result ? (
        // ─── Success State ───────────────────────────────────────────────────
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-lg">
            <CheckCircle className="h-6 w-6" /> Record Registered Successfully
          </div>
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-400 font-medium mb-0.5">Record Name</p>
              <p className="font-medium text-slate-800">{result.recordName}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-400 font-medium mb-0.5">IPFS CID</p>
              <code className="text-xs text-slate-700 break-all">{result.cid}</code>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-400 font-medium mb-0.5">Transaction Hash</p>
              <code className="text-xs text-slate-700 break-all">{result.txHash}</code>
            </div>
          </div>

          {/* Progress log */}
          <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1 max-h-40 overflow-y-auto">
            {progress.map((p, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-500">{p.ts}</span>
                <span className={p.status === 'error' ? 'text-red-400' : 'text-green-400'}>✓</span>
                <span>{p.msg}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <Link
              to="/patient/records"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              View My Records <ChevronRight className="h-4 w-4" />
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm rounded-lg transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      ) : (
        // ─── Upload Form ─────────────────────────────────────────────────────
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !busy && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              busy ? 'border-slate-200 cursor-not-allowed' : 'border-slate-300 hover:border-blue-400 cursor-pointer'
            }`}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-blue-500" />
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                {!busy && <p className="text-xs text-blue-500 mt-1">Click to change file</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="h-10 w-10" />
                <p className="text-sm font-medium">Drag and drop a PDF or click to browse</p>
                <p className="text-xs">Maximum 10 MB · PDF files only</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>

          {/* Record Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Record Name</label>
            <input
              type="text"
              value={recordName}
              onChange={e => setRecordName(e.target.value)}
              placeholder="e.g. Blood Test October 2026"
              disabled={busy}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Progress Log (shown during upload) */}
          {progress.length > 0 && (
            <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1 max-h-36 overflow-y-auto">
              {progress.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500 flex-shrink-0">{p.ts}</span>
                  <span className={p.status === 'error' ? 'text-red-400' : p.status === 'active' ? 'text-yellow-400 animate-pulse' : 'text-green-400'}>
                    {p.status === 'error' ? '✗' : p.status === 'active' ? '⟳' : '✓'}
                  </span>
                  <span className="break-all">{p.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status / spinner */}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-blue-600">
              <Spinner size="sm" /> {stepLabel}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={busy || !file || !recordName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {busy ? 'Processing...' : '🔒 Encrypt and Upload'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Your file is encrypted entirely in your browser. Only ciphertext reaches IPFS — no plaintext or keys ever leave your device.
          </p>
        </div>
      )}
    </div>
  );
}
