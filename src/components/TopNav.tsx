import React from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';
import { 
  Popover, PopoverTrigger, PopoverSurface, 
  Button, 
  makeStyles
} from '@fluentui/react-components';
import { useRBAC } from '../context/RBACContext';
import { useNotification, INotification } from '../context/NotificationContext';
import './TopNav.css';

const ROLE_COLORS: Record<string, string> = {
  GlobalAdmin: '#ef4444',
  UserAdmin:   '#0ea5e9',
};

const useStyles = makeStyles({
  popover: {
    padding: '0',
    borderRadius: '12px',
    border: '1px solid var(--phorexy-border)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  }
});

const TopNav = () => {
  const { currentUser, role } = useRBAC();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  const styles = useStyles();

  const getIcon = (type: INotification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} color="#10b981" />;
      case 'warning': return <AlertCircle size={16} color="#f59e0b" />;
      case 'error':   return <XCircle size={16} color="#ef4444" />;
      default:        return <Info size={16} color="#0ea5e9" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="top-nav">
      <div className="nav-header">
        <h2 className="nav-title">StaunchTech DMS</h2>
        <span className="nav-subtitle">Document Management System</span>
      </div>

      <div className="nav-actions">
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--phorexy-card)', border: `1px solid ${ROLE_COLORS[role] || '#e2e8f0'}`,
          borderRadius: '20px', padding: '4px 12px', fontSize: '12px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_COLORS[role] || '#64748b' }} />
          <span style={{ color: ROLE_COLORS[role] || '#64748b', fontWeight: 600 }}>{role}</span>
        </div>

        <Popover trapFocus>
          <PopoverTrigger disableButtonEnhancement>
            <div className="notification-icon">
              <Bell size={18} color="var(--phorexy-text-muted)" />
              {unreadCount > 0 && <div className="notification-badge">{unreadCount}</div>}
            </div>
          </PopoverTrigger>

          <PopoverSurface className={styles.popover}>
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notifications</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {notifications.length > 0 && (
                    <>
                      <Button size="small" appearance="subtle" onClick={markAllAsRead}>Mark all as read</Button>
                      <Button size="small" appearance="subtle" onClick={clearNotifications}>Clear</Button>
                    </>
                  )}
                </div>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={32} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`notification-item ${n.read ? '' : 'unread'}`}
                      onClick={() => markAsRead(n.id)}
                    >
                      {!n.read && <div className="notification-indicator" />}
                      <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
                      <div className="notification-content">
                        <div className="notification-title">{n.title}</div>
                        <div className="notification-message">{n.message}</div>
                        <div className="notification-time">{formatTime(n.timestamp)}</div>
                        {n.action && n.actionLabel && (
                          <Button 
                            size="small" 
                            appearance="outline" 
                            style={{ marginTop: '8px', height: '24px', fontSize: '11px' }}
                            onClick={(e) => { e.stopPropagation(); n.action?.(); }}
                          >
                            {n.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </PopoverSurface>
        </Popover>

        <div className="user-profile-top">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || 'Admin')}&background=0ea5e9&color=fff&size=36`}
            alt="User"
            className="top-avatar"
          />
          <div className="top-user-info">
            <span className="top-user-name">{currentUser?.displayName || 'Admin User'}</span>
            <span className="top-user-role" style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {currentUser?.email || 'Administrator'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
