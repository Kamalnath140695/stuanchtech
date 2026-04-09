import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Users, AppWindow, ShieldCheck, ClipboardList, ArrowRight } from 'lucide-react';
import { useRBAC } from '../context/RBACContext';

const Card = ({ icon, title, desc, path, color }: any) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        padding: '28px', backgroundColor: 'var(--staunch-card)', borderRadius: '16px',
        border: '1px solid var(--staunch-border)', cursor: 'pointer', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}
      onMouseOver={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}20`; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--staunch-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {React.cloneElement(icon, { size: 24, color })}
      </div>
      <div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: 0, color: 'var(--staunch-text-muted)', fontSize: '13px', lineHeight: '1.5' }}>{desc}</p>
      </div>
      <div style={{ color, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', marginTop: 'auto' }}>
        Open <ArrowRight size={14} />
      </div>
    </div>
  );
};

const LandingPage = () => {
  const { role, currentUser, can } = useRBAC();

  const modules = [
    { icon: <LayoutDashboard />, title: 'Dashboard', desc: 'Live metrics: storage usage, file counts, user stats, and container analytics.', path: '/dashboard', color: '#0ea5e9', show: true },
    { icon: <FolderOpen />, title: 'Container Management', desc: 'Create and manage SharePoint Embedded containers. View storage, metadata, and files.', path: '/admin/containers', color: '#8b5cf6', show: true },
    { icon: <Users />, title: 'User Management', desc: 'Create users via Graph API, assign roles (GlobalAdmin / UserAdmin), and manage access.', path: '/admin/users', color: '#10b981', show: true },
    { icon: <AppWindow />, title: 'App Management', desc: 'Register Azure AD apps, assign containers, and view linked container permissions.', path: '/admin/apps', color: '#f59e0b', show: can('createApp') },
    { icon: <ShieldCheck />, title: 'Permission Management', desc: 'Assign users and apps to containers with owner/writer/reader roles. Remove access instantly.', path: '/admin/permissions', color: '#ef4444', show: can('assignPermission') },
    { icon: <ClipboardList />, title: 'Audit Logs', desc: 'Full audit trail of all admin actions: user creation, permission changes, container operations.', path: '/admin/audit', color: '#64748b', show: can('viewAuditLogs') },
  ].filter(m => m.show);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto', paddingTop: '32px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 700 }}>
          Welcome back, {currentUser?.displayName || 'Admin'}
        </h1>
        <p style={{ margin: 0, color: 'var(--staunch-text-muted)', fontSize: '15px' }}>
          StaunchTech DMS Admin · Role: <strong style={{ color: 'var(--staunch-accent)' }}>{role}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {modules.map((m, i) => <Card key={i} {...m} />)}
      </div>
    </div>
  );
};

export default LandingPage;
