import React, { useState, useEffect } from 'react';
import { Terminal, Download, Trash2, Search, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { getLogs, clearLogs, exportLogs } from '../services/logger';
import toast from 'react-hot-toast';

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const reload = () => {
    setLogs(getLogs());
  };

  useEffect(() => {
    reload();
    const handleNewLog = () => reload();
    window.addEventListener('medchain:new-log', handleNewLog);
    window.addEventListener('medchain:logs-cleared', handleNewLog);
    return () => {
      window.removeEventListener('medchain:new-log', handleNewLog);
      window.removeEventListener('medchain:logs-cleared', handleNewLog);
    };
  }, []);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all system logs?')) {
      clearLogs();
      toast.success('Logs cleared');
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === 'ALL' || log.level === filter;
    const matchesSearch =
      !search ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const levelBadge = (level) => {
    switch (level) {
      case 'SUCCESS':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" /> SUCCESS</span>;
      case 'WARN':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" /> WARN</span>;
      case 'ERROR':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" /> ERROR</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700"><Info className="h-3 w-3" /> INFO</span>;
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">System Activity & Event Logs</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        Real-time audit log of wallet sessions, smart contract transactions, IPFS uploads, and error reports.
      </p>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 mb-4 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search log messages or details..."
            className="w-full text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
          {['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === lvl
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-md overflow-hidden text-slate-200 font-mono text-xs">
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <span>Displaying {filteredLogs.length} of {logs.length} logged events</span>
          <span>Auto-saved to localStorage</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No events match the current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-slate-800/50 transition-colors flex items-start gap-3">
                <span className="text-slate-400 text-[11px] whitespace-nowrap mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-shrink-0">{levelBadge(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 font-medium break-words">{log.message}</p>
                  {log.details && (
                    <p className="text-slate-400 text-[11px] mt-1 bg-slate-950/60 p-2 rounded border border-slate-800/80 break-all whitespace-pre-wrap">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
