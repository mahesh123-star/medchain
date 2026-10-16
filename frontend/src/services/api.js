const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const AI_SERVICE = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res;
}

export async function uploadEncryptedFile(encryptedBytes, recordName) {
  const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
  const form = new FormData();
  form.append('file', blob, recordName + '.enc');
  form.append('record_name', recordName);
  const res = await fetch(`${BACKEND}/ipfs/upload`, { method: 'POST', body: form });
  await handleResponse(res);
  return res.json();
}

export async function retrieveEncryptedFile(cid) {
  const res = await fetch(`${BACKEND}/ipfs/retrieve/${cid}`);
  await handleResponse(res);
  return res.arrayBuffer();
}

export async function storeKey(recordId, aesKeyB64, ivB64) {
  const res = await fetch(`${BACKEND}/keys/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_id: recordId, aes_key_b64: aesKeyB64, iv_b64: ivB64 }),
  });
  await handleResponse(res);
  return res.json();
}

export async function grantKey(recordId, doctorAddress) {
  const res = await fetch(`${BACKEND}/keys/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_id: recordId, doctor_address: doctorAddress }),
  });
  await handleResponse(res);
  return res.json();
}

export async function retrieveKey(recordId, doctorAddress) {
  const res = await fetch(`${BACKEND}/keys/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_id: recordId, doctor_address: doctorAddress }),
  });
  await handleResponse(res);
  return res.json();
}

export async function summarizeReport(text = '', pdfBase64 = null) {
  const res = await fetch(`${AI_SERVICE}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text || '', pdf_base64: pdfBase64 }),
  });
  await handleResponse(res);
  return res.json();
}
