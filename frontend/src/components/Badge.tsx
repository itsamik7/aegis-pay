import React from 'react';

interface TierBadgeProps {
  tier: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, label, size = 'md' }) => {
  const configs: Record<number, { bg: string; text: string; border: string; defaultLabel: string }> = {
    0: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', defaultLabel: 'Tier 0: Standard' },
    1: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', defaultLabel: 'Tier 1: Passive Monitoring' },
    2: { bg: 'bg-amber-50', text: 'text-amber-750', border: 'border-amber-200', defaultLabel: 'Tier 2: Targeted Query' },
    3: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', defaultLabel: 'Tier 3: Enhanced Review' },
    4: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', defaultLabel: 'Tier 4: Senior Review' },
    5: { bg: 'bg-purple-900', text: 'text-purple-100', border: 'border-purple-700', defaultLabel: 'Tier 5: Compliance Decision' },
  };

  const cfg = configs[tier] || configs[0];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-semibold px-2.5 py-1',
    lg: 'text-sm font-bold px-3 py-1.5',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tier === 5 ? 'bg-purple-300' : 'bg-current'}`} />
      {label || cfg.defaultLabel}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, string> = {
    Low: 'bg-slate-100 text-slate-700 border-slate-200',
    Medium: 'bg-amber-50 text-amber-800 border-amber-200',
    High: 'bg-orange-50 text-orange-800 border-orange-200',
    Critical: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${map[severity] || map.Low}`}>
      {severity}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'New') style = 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Assigned') style = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (status === 'Under Review' || status === 'Under Investigation') style = 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
  if (status === 'Merchant Information Requested' || status === 'Pending Merchant Clarification') style = 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Escalated' || status === 'Senior Review Pending') style = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
  if (status === 'Cleared' || status === 'Closed — Cleared') style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Confirmed Policy Breach' || status === 'Closed — Simulated Containment') style = 'bg-slate-900 text-rose-400 border-slate-800';

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
};

export const ProvenanceBadge: React.FC<{ provenance: string }> = ({ provenance }) => {
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
  if (provenance.includes('Directly Observed')) badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  else if (provenance.includes('Derived')) badgeStyle = 'bg-blue-50 text-blue-800 border-blue-300';
  else if (provenance.includes('Merchant-declared')) badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300';
  else if (provenance.includes('Corroboration')) badgeStyle = 'bg-purple-50 text-purple-800 border-purple-300';
  else if (provenance.includes('Inference')) badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-300';

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium tracking-tight ${badgeStyle}`}>
      <span className="font-semibold uppercase tracking-wider text-[9px] opacity-75">Provenance:</span>
      {provenance}
    </span>
  );
};
