import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, children, decorationColor }) {
  const decorationClasses = {
    red: 'border-t-4 border-t-red-500',
    orange: 'border-t-4 border-t-orange-500',
    emerald: 'border-t-4 border-t-emerald-500',
    blue: 'border-t-4 border-t-blue-500',
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 shadow-sm p-6",
      decorationColor && decorationClasses[decorationColor],
      className
    )}>
      {children}
    </div>
  );
}