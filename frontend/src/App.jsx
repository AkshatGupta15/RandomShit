import React from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { StatCard } from './features/dashboard/StatCard';
import { RiskChart } from './features/dashboard/RiskChart';
import { ExpiryChart } from './features/dashboard/ExpiryChart';

function App() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Expiring Certificates" 
            metric="9" 
            subtext="Critical Action Required" 
            color="red" 
          />
          <StatCard 
            title="High Risk Assets" 
            metric="14" 
            subtext="Legacy RSA Detected" 
            color="orange" 
          />
          <StatCard 
            title="Elite-PQC Ready" 
            metric="56" 
            subtext="Kyber Secured" 
            color="emerald" 
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RiskChart />
          <ExpiryChart />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;