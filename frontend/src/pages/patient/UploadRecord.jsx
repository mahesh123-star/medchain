import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { getContract } from '../../services/web3';
import { generateKeyAndIV, encryptFile } from '../../services/crypto';
import { uploadEncryptedFile, storeKey } from '../../services/api';
import Spinner from '../../components/Spinner';
import toast from 'react-hot-toast';

const MAX_SIZE = 10 * 1024 * 1024;

export default function UploadRecord() {
  const { signer } = useWallet();
  const [file, setFile] = useState(null);
  const [recordName, setRecordName] = useState('');
  const [step, setStep] = useState('idle');
  const [result, setResult] = useState(null);
  const fileRef = useRef();

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
    try {
      setStep('encrypting');
      const { key, iv, keyB64, ivB64 } = await generateKeyAndIV();
      const encryptedBytes = await encryptFile(file, key, iv);
      setStep('uploading');
      const { cid } = await uploadEncryptedFile(encryptedBytes, recordName);
      setStep('registering');
      const contract = getContract(signer);
      const tx = await contract.uploadRecord(cid, recordName);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
        .find(e => e && e.name === 'RecordUploaded');
      const recordId = event?.args?.recordId;
      if (recordId) await storeKey(recordId.toString(), keyB64, ivB64);
      setResult({ cid, recordId: recordId?.toString(), txHash: receipt.hash });
      setStep('done');
      toast.success('Record uploaded and registered!');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
      setStep('idle');
    }
  };

  const reset = () => { setFile(null); setRecordName(''); setStep('idle'); setResult(null); };
  const busy = ['encrypting', 'uploading', 'registering'].includes(step);
  const stepLabels = { encrypting: 'Encrypting...', uploading: 'Uploading to IPFS...', registering: 'Registering on blockchain...' };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Upload Medical Record</h1>
      <p className="text-slate-500 text-sm mb-6">Files are AES-256-GCM encrypted in your browser before upload.</p>
      {step === 'done' ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-semibold"><CheckCircle className="h-5 w-5" /> Record Registered</div>
          <p className="text-sm text-slate-600">CID: <code className="text-xs bg-slate-100 px-1 rounded break-all">{result?.cid}</code></p>
          <p className="text-sm text-slate-600">Tx: <code className="text-xs bg-slate-100 px-1 rounded break-all">{result?.txHash}</code></p>
          <button onClick={reset} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Upload Another</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-10 text-center cursor-pointer transition-colors">
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-blue-500" />
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="h-10 w-10" />
                <p className="text-sm">Drag and drop a PDF or click to browse</p>
                <p className="text-xs">Max 10 MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Record Name</label>
            <input type="text" value={recordName} onChange={e => setRecordName(e.target.value)} placeholder="e.g. Blood Test Oct 2026" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {busy && <div className="flex items-center gap-3 text-sm text-blue-600"><Spinner size="sm" /> {stepLabels[step]}</div>}
          <button onClick={handleUpload} disabled={busy || !file} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Encrypt and Upload</button>
          <p className="text-xs text-slate-400">Your file is encrypted in your browser. The backend only stores encrypted bytes.</p>
        </div>
      )}
    </div>
  );
}
