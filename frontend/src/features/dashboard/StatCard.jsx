import React from 'react';
import { Card } from '../../components/ui/Card';

export function StatCard({ title, metric, subtext, color }) {
  return (
    <Card decorationColor={color}>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-semibold text-slate-900">{metric}</p>
        <span className="text-sm font-medium text-slate-500">{subtext}</span>
      </div>
    </Card>
  );
}