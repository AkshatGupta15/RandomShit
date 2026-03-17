import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../../components/ui/Card';

const data = [
  { time: '0-30 Days', count: 3 },
  { time: '30-60 Days', count: 4 },
  { time: '60-90 Days', count: 2 },
  { time: '>90 Days', count: 84 },
];

export function ExpiryChart() {
  return (
    <Card className="flex flex-col h-[400px]">
      <h3 className="text-lg font-semibold text-slate-900">Certificate Expiry Timeline</h3>
      <p className="text-sm text-slate-500 mb-4">Cryptographic renewal schedule.</p>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip 
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} /> {/* rose-500 */}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}