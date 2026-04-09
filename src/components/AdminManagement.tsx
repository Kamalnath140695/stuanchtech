import React from 'react';
import { TabList, Tab, makeStyles } from '@fluentui/react-components';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useRBAC } from '../context/RBACContext';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px 0' },
  content: { marginTop: '24px' },
});

const ROLE_COLORS: Record<string, string> = {
  GlobalAdmin: '#ef4444',
  UserAdmin:   '#0ea5e9',
};

const AdminManagement = () => {
  const styles = useStyles();
  const location = useLocation();
  const { can, role } = useRBAC();

  const selected = location.pathname.startsWith('/admin/users')      ? 'users'
    : location.pathname.startsWith('/admin/apps')                    ? 'apps'
    : location.pathname.startsWith('/admin/permissions')             ? 'permissions'
    : location.pathname.startsWith('/admin/audit')                   ? 'audit'
    : 'containers';

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Admin Management</h1>
        <div style={{
          fontSize: '12px', background: 'var(--phorexy-card)',
          border: `1px solid ${ROLE_COLORS[role] || '#e2e8f0'}`,
          borderRadius: '20px', padding: '4px 14px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_COLORS[role] || '#64748b' }} />
          <span style={{ color: ROLE_COLORS[role] || '#64748b', fontWeight: 600 }}>{role}</span>
        </div>
      </div>

      <TabList selectedValue={selected}>
        <Tab value="containers">
          <Link to="/admin/containers" style={{ textDecoration: 'none', color: 'inherit' }}>Containers</Link>
        </Tab>

        <Tab value="users">
          <Link to="/admin/users" style={{ textDecoration: 'none', color: 'inherit' }}>Users</Link>
        </Tab>

        {/* Applications — GlobalAdmin only */}
        {can('createApp') && (
          <Tab value="apps">
            <Link to="/admin/apps" style={{ textDecoration: 'none', color: 'inherit' }}>Applications</Link>
          </Tab>
        )}

        {/* Permissions — GlobalAdmin or UserAdmin */}
        {can('assignPermission') && (
          <Tab value="permissions">
            <Link to="/admin/permissions" style={{ textDecoration: 'none', color: 'inherit' }}>Permissions</Link>
          </Tab>
        )}

        {/* Audit Logs — GlobalAdmin or UserAdmin */}
        {can('viewAuditLogs') && (
          <Tab value="audit">
            <Link to="/admin/audit" style={{ textDecoration: 'none', color: 'inherit' }}>Audit Logs</Link>
          </Tab>
        )}
      </TabList>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
};

export default AdminManagement;
