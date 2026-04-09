import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Users, AppWindow, ShieldCheck, Power, ClipboardList, ChevronDown } from 'lucide-react';
import { useRBAC, AppRole } from '../context/RBACContext';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const ROLE_COLORS: Record<AppRole, string> = {
  GlobalAdmin: '#ef4444',
  UserAdmin:   '#0ea5e9',
  NormalUser:  '#10b981',
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, trueRole, currentUser, can, setRole } = useRBAC();
  const { logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      // Note: logout() in authService now handles the redirect to /login
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: navigate directly if service fails
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const availableRoles: AppRole[] = trueRole === 'GlobalAdmin' 
    ? ['GlobalAdmin', 'UserAdmin', 'NormalUser']
    : trueRole === 'UserAdmin' 
      ? ['UserAdmin', 'NormalUser']
      : ['NormalUser'];

  const navItems = [
    { path: '/dashboard',         icon: <LayoutDashboard size={18} />, label: 'Dashboard',    show: true },
    { path: '/admin/containers',  icon: <FolderOpen size={18} />,      label: 'Containers',   show: true },
    { path: '/admin/users',       icon: <Users size={18} />,           label: 'Users',        show: can('manageNormalUsers') },
    { path: '/admin/apps',        icon: <AppWindow size={18} />,       label: 'Applications', show: can('createApp') || can('manageAllApps') },
    { path: '/admin/permissions', icon: <ShieldCheck size={18} />,     label: 'Permissions',  show: can('assignPermission') },
    { path: '/admin/audit',       icon: <ClipboardList size={18} />,   label: 'Audit Logs',   show: can('viewAuditLogs') },
  ];

  const handleRoleChange = (r: AppRole) => {
    setRole(r);
    setSwitching(false);
    navigate('/dashboard'); // Reset view on role change
  };

  return (
    <div className="phorexy-sidebar">
      <div className="sidebar-brand">
        <ShieldCheck color="var(--phorexy-accent)" size={26} />
        <span style={{ fontSize: '16px', fontWeight: 700 }}>Admin Portal</span>
      </div>

      <div className="nav-section">
        <ul className="nav-list">
          {navItems.filter(n => n.show).map(item => (
            <li
              key={item.path}
              className={`nav-item ${isActive(item.path) || (item.path === '/dashboard' && location.pathname === '/') ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ padding: '0 16px', marginTop: 'auto', marginBottom: '16px' }}>
        <div 
          onClick={() => availableRoles.length > 1 && setSwitching(!switching)}
          style={{ 
            background: 'var(--phorexy-card-hover)', 
            border: `1px solid ${ROLE_COLORS[role]}40`, 
            borderRadius: '8px', 
            padding: '10px 12px',
            cursor: availableRoles.length > 1 ? 'pointer' : 'default',
            position: 'relative'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
            <span>ACTIVE ROLE</span>
            {availableRoles.length > 1 && <ChevronDown size={12} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_COLORS[role] }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: ROLE_COLORS[role] }}>{role}</span>
          </div>

          {switching && (
            <div style={{ 
              position: 'absolute', bottom: '100%', left: 0, right: 0, 
              background: 'var(--phorexy-card)', border: '1px solid var(--phorexy-border)',
              borderRadius: '8px', marginBottom: '12px', overflow: 'hidden',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', zIndex: 9999,
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ padding: '8px 12px 4px 12px', fontSize: '10px', color: 'var(--phorexy-text-muted)', fontWeight: 600 }}>SWITCH TO:</div>
              {availableRoles.map(r => (
                <div 
                  key={r} 
                  onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    handleRoleChange(r); 
                  }}
                  style={{ 
                    padding: '12px 12px', fontSize: '14px', cursor: 'pointer',
                    background: role === r ? 'rgba(14,165,233,0.1)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    color: ROLE_COLORS[r], fontWeight: role === r ? 600 : 500,
                    transition: 'background 0.2s',
                    borderBottom: '1px solid var(--phorexy-border)40'
                  }}
                  className="role-option"
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_COLORS[r] }} />
                  {r}
                  {r === trueRole && <span style={{ fontSize: '10px', marginLeft: 'auto', opacity: 1, color: 'var(--phorexy-accent)' }}>✓ Authentic</span>}
                </div>
              ))}
              {role !== trueRole && (
                <div 
                  onClick={() => handleRoleChange(trueRole)}
                  style={{ padding: '10px 12px', fontSize: '11px', textAlign: 'center', color: 'var(--phorexy-accent)', cursor: 'pointer', background: 'var(--phorexy-card-hover)', borderTop: '1px solid var(--phorexy-border)' }}
                >
                  Reset to {trueRole}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar" style={{ background: ROLE_COLORS[role], color: '#fff', fontSize: '14px' }}>
            {(currentUser?.displayName || 'A')[0].toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{currentUser?.displayName || 'Admin User'}</div>
            <div className="user-id" style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {currentUser?.email || ''}
            </div>
          </div>
        </div>
        <div className="sign-out" onClick={handleLogout} style={{ cursor: 'pointer' }}>
          <Power size={15} />
          <span>Sign Out</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
