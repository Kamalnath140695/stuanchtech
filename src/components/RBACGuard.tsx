import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useRBAC, AppRole, Permission } from '../context/RBACContext';

interface RBACGuardProps {
  /** Require one of these roles (checks active role) */
  roles?: AppRole[];
  /** Require this permission */
  permission?: Permission;
  children: React.ReactNode;
  /** Custom fallback — defaults to access-denied card */
  fallback?: React.ReactNode;
}

const DefaultDenied = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '64px 32px', gap: '16px', textAlign: 'center',
  }}>
    <ShieldAlert size={48} color="#ef4444" strokeWidth={1.5} />
    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--phorexy-text)' }}>Access Denied</div>
    <div style={{ fontSize: '14px', color: 'var(--phorexy-text-muted)', maxWidth: '360px' }}>
      You do not have permission to view this section. Contact your administrator to request access.
    </div>
  </div>
);

const RBACGuard: React.FC<RBACGuardProps> = ({ roles, permission, children, fallback }) => {
  const { role, can } = useRBAC();

  const roleAllowed = !roles || roles.includes(role);
  const permAllowed = !permission || can(permission);

  if (!roleAllowed || !permAllowed) {
    return <>{fallback ?? <DefaultDenied />}</>;
  }

  return <>{children}</>;
};

export default RBACGuard;
