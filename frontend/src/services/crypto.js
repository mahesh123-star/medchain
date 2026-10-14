export async function generateKeyAndIV() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await crypto.subtle.exportKey('raw', key);
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(keyBytes)));
  const ivB64 = btoa(String.fromCharCode(...iv));
  return { key, iv, keyB64, ivB64 };
}

export async function encryptFile(file, key, iv) {
  const fileBuffer = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileBuffer);
  return new Uint8Array(encrypted);
}

export async function decryptData(encryptedBytes, keyB64, ivB64) {
  const keyBytes = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBytes);
  return new Uint8Array(decrypted);
}
