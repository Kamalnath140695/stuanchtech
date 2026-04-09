import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';

import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import DashboardWrapper from './components/DashboardWrapper';
import AdminManagement from './components/AdminManagement';
import UserHomePage from './components/UserHomePage';
import Containers from './components/containers';
import UserManagement from './components/UserManagement';
import AppManagement from './components/AppManagement';
import PermissionManagement from './components/PermissionManagement';
import AuditLogs from './components/AuditLogs';
import AuthCallback from './pages/AuthCallback';

import Login from './components/Login';
import Signup from './components/Signup';
import PendingApprovalPage from './components/PendingApprovalPage';
import StorageWarningBanner from './components/StorageWarningBanner';
import { RBACProvider } from './context/RBACContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import RBACGuard from './components/RBACGuard';
import { useAuth } from './context/AuthContext';
import MSALHandler from './components/MSALHandler';
import './App.css';

const storedRole = localStorage.getItem('adminRole');
if (storedRole && !['GlobalAdmin', 'UserAdmin'].includes(storedRole)) {
  localStorage.removeItem('adminRole');
}

const clearMSALCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('msal.') || key.includes('login.windows.net') || key.includes('login.microsoftonline.com')) {
      localStorage.removeItem(key);
    }
  });
  // Also clear sessionStorage MSAL keys
  const sessionKeys = Object.keys(sessionStorage);
  sessionKeys.forEach(key => {
    if (key.startsWith('msal.') || key.includes('login.windows.net') || key.includes('login.microsoftonline.com')) {
      sessionStorage.removeItem(key); 
    }
  });
};

// Only clear cache on error, not on auth-callback
if (window.location.href.includes('error=') && !window.location.pathname.includes('/auth-callback')) {
  console.log('[App] Clearing MSAL cache due to error');
  clearMSALCache();
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Helper function to get role-based homepage
function getRoleBasedHomepage(role?: string): string {
  if (!role) return '/user/homepage';
  
  const normalizedRole = role.toUpperCase().replace('_', '');
  // Map all possible role formats to their dashboards
  switch (normalizedRole) {
    case 'GLOBALADMIN':
    case 'GLOBAL_ADMIN':
      return '/globaladmin/homepage';
    case 'USERADMIN':
    case 'USER_ADMIN':
      return '/useradmin/homepage';
    case 'NORMALUSER':
    case 'USER':
    case 'NORMAL_USER':
      return '/user/homepage';
    default:
      return '/user/homepage';
  }
}

function AppRoutes() {
  const { currentUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('[AppRoutes] Current route:', location.pathname + location.hash);
  }, [location]);

  const isAuthenticated = !!currentUser;
  const isPendingApproval = currentUser?.role === 'PendingApproval';
  const isAdmin = ['GlobalAdmin', 'UserAdmin', 'GLOBAL_ADMIN', 'USER_ADMIN'].includes(currentUser?.role || '');

  return (
    <div className="App">
      <Routes>
        {/* Auth callback must always be accessible */}
        <Route path="/auth-callback" element={<AuthCallback />} />
        

        
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/login/pendingapprovaluser" element={<PendingApprovalPage />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : isPendingApproval ? (
          <>
            <Route path="/login/pendingapprovaluser" element={<PendingApprovalPage />} />
            <Route path="*" element={<Navigate to="/login/pendingapprovaluser" replace />} />
          </>
        ) : (
          <>
            {/* Root route redirects to role-specific homepage */}
            <Route path="/" element={<Navigate to={getRoleBasedHomepage(currentUser?.role)} replace />} />
            <Route path="/dashboard" element={
              <>
                <StorageWarningBanner />
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                  <TopNav />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
                    <DashboardWrapper />
                  </div>
                </div>
              </>
            } />
            
            {/* User homepage - for normal users */}
            <Route path="/user/homepage" element={
              <>
                <StorageWarningBanner />
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                  <TopNav />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
                    <UserHomePage />
                  </div>
                </div>
              </>
            } />
            
            {/* UserAdmin homepage */}
            <Route path="/useradmin/homepage" element={
              <>
                <StorageWarningBanner />
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                  <TopNav />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
                    <AdminManagement />
                  </div>
                </div>
              </>
            } />
            
            {/* GlobalAdmin homepage */}
            <Route path="/globaladmin/homepage" element={
              <>
                <StorageWarningBanner />
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                  <TopNav />
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
                    <AdminManagement />
                  </div>
                </div>
              </>
            } />
            
            {/* Admin routes - only for GlobalAdmin and UserAdmin */}
            {isAdmin && (
              <Route path="/admin" element={
                <>
                  <StorageWarningBanner />
                  <Sidebar />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                    <TopNav />
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
                      <AdminManagement />
                    </div>
                  </div>
                </>
              }>
                <Route path="containers" element={<Containers />} />
                <Route path="users" element={
                  <RBACGuard permission="manageNormalUsers">
                    <UserManagement />
                  </RBACGuard>
                } />
                <Route path="apps" element={
                  <RBACGuard permission="manageAllApps">
                    <AppManagement />
                  </RBACGuard>
                } />
                <Route path="permissions" element={
                  <RBACGuard permission="assignPermission">
                    <PermissionManagement />
                  </RBACGuard>
                } />
                <Route path="audit" element={
                  <RBACGuard permission="viewAuditLogs">
                    <AuditLogs />
                  </RBACGuard>
                } />
              </Route>
            )}
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FluentProvider theme={webLightTheme}>
        <AuthProvider>
          <NotificationProvider>
            <RBACProvider>
              <MSALHandler>
                <AppRoutes />
              </MSALHandler>
            </RBACProvider>
          </NotificationProvider>
          </AuthProvider>
        </FluentProvider>
      </BrowserRouter>
    );
}

export default App;
