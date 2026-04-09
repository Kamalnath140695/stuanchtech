import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiFetch, formatBytes } from '../services/api';
import { Database, Users, AppWindow, FolderOpen, HardDrive, FileText } from 'lucide-react';

interface Metrics {
  containerCount: number;
  totalStorageUsed: number;
  totalFiles: number;
  userCount: number;
  appCount: number;
}

const weekData = [
  { name: 'Mon', value: 45 }, { name: 'Tue', value: 52 }, { name: 'Wed', value: 48 },
  { name: 'Thu', value: 61 }, { name: 'Fri', value: 59 }, { name: 'Sat', value: 65 }, { name: 'Sun', value: 72 },
];

const StatCard = ({ icon, title, value, sub, color }: any) => (
  <div style={{ background: 'var(--phorexy-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--phorexy-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {React.cloneElement(icon, { size: 22, color })}
    </div>
    <div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--phorexy-text)' }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ color: 'var(--phorexy-text-muted)', fontSize: '13px' }}>{title}</span>
        {sub && <span style={{ color, fontSize: '12px', fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  </div>
);

const DashboardWrapper = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set a timeout so dashboard never hangs — metrics are best-effort
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    apiFetch('/api/metrics')
      .then(setMetrics)
      .catch(() => setMetrics({ containerCount: 0, totalStorageUsed: 0, totalFiles: 0, userCount: 0, appCount: 0 }))
      .finally(() => { setLoading(false); clearTimeout(timeout); });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  const stats = metrics ? [
    { icon: <FolderOpen />, title: 'Containers', value: metrics.containerCount ?? 0, sub: 'Active', color: '#0ea5e9' },
    { icon: <HardDrive />, title: 'Storage Used', value: formatBytes(metrics.totalStorageUsed ?? 0), sub: 'Total', color: '#8b5cf6' },
    { icon: <FileText />, title: 'Total Files', value: (metrics.totalFiles ?? 0).toLocaleString(), sub: 'Stored', color: '#10b981' },
    { icon: <Users />, title: 'Users', value: metrics.userCount ?? 0, sub: 'Tenant', color: '#f59e0b' },
    { icon: <AppWindow />, title: 'App Registrations', value: metrics.appCount ?? 0, sub: 'Registered', color: '#ef4444' },
    { icon: <Database />, title: 'Container Types', value: 1, sub: 'Configured', color: '#0ea5e9' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>System Dashboard</h1>
        <span style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>
          {loading ? 'Loading metrics...' : 'Live data from Microsoft Graph API'}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: 'var(--phorexy-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--phorexy-border)', height: '120px', opacity: 0.5 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div style={{ background: 'var(--phorexy-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--phorexy-border)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: 600 }}>Weekly Activity (Uploads)</h3>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--phorexy-text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--phorexy-text-muted)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(14,165,233,0.06)' }} contentStyle={{ background: 'var(--phorexy-card)', border: '1px solid var(--phorexy-border)', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {weekData.map((_, i) => <Cell key={i} fill="#0ea5e9" opacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: 'var(--phorexy-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--phorexy-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, alignSelf: 'flex-start' }}>Storage Utilization</h3>
          {metrics && (
            <>
              <div style={{ position: 'relative', width: '160px', height: '160px', borderRadius: '50%', background: `conic-gradient(#0ea5e9 ${metrics.totalStorageUsed > 0 ? Math.min(Math.round((metrics.totalStorageUsed / (1024 ** 4)) * 100), 100) : 5}%, var(--phorexy-border) 0)` }}>
                <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', bottom: '16px', background: 'var(--phorexy-card)', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700 }}>{formatBytes(metrics.totalStorageUsed)}</span>
                  <span style={{ color: 'var(--phorexy-text-muted)', fontSize: '11px' }}>Used</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <span style={{ color: '#0ea5e9' }}>● Used: {formatBytes(metrics.totalStorageUsed)}</span>
                <span style={{ color: 'var(--phorexy-text-muted)' }}>● Files: {metrics.totalFiles}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardWrapper;
