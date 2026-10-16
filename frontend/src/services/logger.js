/**
 * MedChain Persistent Application & Audit Logger.
 * Records all client-side events, wallet changes, smart contract calls,
 * and errors into localStorage so logs survive page refreshes.
 */

const STORAGE_KEY = 'medchain_system_logs';
const MAX_LOGS = 500;

export function getLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logEvent(level, message, details = null) {
  try {
    const logs = getLogs();
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(), // 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'
      message,
      details: typeof details === 'object' && details !== null ? JSON.stringify(details) : details,
    };
    logs.unshift(entry); // Newest first
    if (logs.length > MAX_LOGS) logs.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('medchain:new-log', { detail: entry }));
    return entry;
  } catch (e) {
    console.error('Failed to write log', e);
  }
}

export function clearLogs() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('medchain:logs-cleared'));
}

export function exportLogs() {
  const logs = getLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medchain_logs_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
