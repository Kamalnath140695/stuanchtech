import React, { useEffect, useState, useCallback } from 'react';
import { Button, Badge, Spinner, Input, Select, makeStyles } from '@fluentui/react-components';
import { DeleteRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';
import { apiFetch } from '../services/api';
import { useRBAC } from '../context/RBACContext';

interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  actor: string;
  target: string;
  details: string;
  status: 'success' | 'error';
}

const ACTION_COLOR: Record<string, any> = {
  CREATE_USER: 'success', DELETE_USER: 'danger', ASSIGN_ROLE: 'warning',
  CREATE_CONTAINER: 'success', DELETE_CONTAINER: 'danger',
  CREATE_APP: 'success', DELETE_APP: 'danger', ASSIGN_APP_CONTAINER: 'informative',
  ADD_PERMISSION: 'informative', REMOVE_PERMISSION: 'warning',
};

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', rowGap: '20px' },
  filters: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' },
  row: {
    display: 'grid',
    gridTemplateColumns: '180px 120px 1fr 1fr 1fr 80px',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    alignItems: 'center',
    borderBottom: '1px solid var(--phorexy-border)',
  },
});

const AuditLogs = () => {
  const styles = useStyles();
  const { can } = useRBAC();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/audit-logs?limit=200');
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClear = async () => {
    if (!window.confirm('Clear all audit logs?')) return;
    await apiFetch('/api/audit-logs', { method: 'DELETE' });
    setLogs([]);
  };

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.action.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Audit Logs</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button appearance="subtle" icon={<ArrowClockwiseRegular />} onClick={load}>Refresh</Button>
          {can('createApp') && (
            <Button appearance="subtle" icon={<DeleteRegular />} onClick={handleClear}>Clear All</Button>
          )}
        </div>
      </div>

      <div className={styles.filters}>
        <div>
          <Input placeholder="Search logs..." value={search} onChange={(_, d) => setSearch(d.value)} style={{ width: '260px' }} />
        </div>
        <div>
          <Select value={actionFilter} onChange={(_, d) => setActionFilter(d.value)} style={{ width: '200px' }}>
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)', alignSelf: 'center' }}>
          {filtered.length} of {logs.length} entries
        </div>
      </div>

      {loading ? (
        <Spinner size="medium" label="Loading audit logs..." />
      ) : (
        <div style={{ background: 'var(--phorexy-card)', border: '1px solid var(--phorexy-border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div className={styles.row} style={{ background: 'var(--phorexy-card-hover)', fontWeight: 600, fontSize: '12px', color: 'var(--phorexy-text-muted)', borderBottom: '1px solid var(--phorexy-border)' }}>
            <span>Timestamp</span>
            <span>Status</span>
            <span>Action</span>
            <span>Target</span>
            <span>Details</span>
            <span>Actor</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--phorexy-text-muted)' }}>No audit log entries found.</div>
          ) : (
            filtered.map(log => (
              <div key={log.id} className={styles.row} style={{ background: log.id % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                <span style={{ color: 'var(--phorexy-text-muted)', fontSize: '12px' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span>
                  <Badge appearance="outline" color={log.status === 'success' ? 'success' : 'danger'}>{log.status}</Badge>
                </span>
                <span>
                  <Badge appearance="filled" color={ACTION_COLOR[log.action] || 'subtle'} style={{ fontSize: '11px' }}>{log.action}</Badge>
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.target}</span>
                <span style={{ color: 'var(--phorexy-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</span>
                <span style={{ color: 'var(--phorexy-text-muted)', fontSize: '12px' }}>{log.actor}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
