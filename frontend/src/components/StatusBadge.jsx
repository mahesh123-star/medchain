import React from 'react';
const configs = {
  0: { label: 'None', cls: 'bg-gray-100 text-gray-600' },
  1: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  2: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  3: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  4: { label: 'Revoked', cls: 'bg-orange-100 text-orange-700' },
};
export default function StatusBadge({ status }) {
  const cfg = configs[Number(status)] || configs[0];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
