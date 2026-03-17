import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../../components/ui/Card';

const data = [
  { name: 'Public Web Apps', value: 42, color: '#3b82f6' }, // blue-500
  { name: 'APIs', value: 26, color: '#06b6d4' },            // cyan-500
  { name: 'Servers', value: 37, color: '#6366f1' },         // indigo-500
];

export function RiskChart() {
  return (
    <Card className="flex flex-col h-[400px]">
      <h3 className="text-lg font-semibold text-slate-900">Asset Risk Distribution</h3>
      <p className="text-sm text-slate-500 mb-4">Categorization by infrastructure type.</p>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}