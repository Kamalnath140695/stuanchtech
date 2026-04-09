$content = @'
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';

export type AppRole = 'GlobalAdmin' | 'UserAdmin' | 'NormalUser';
export type ContainerRole = 'owner' | 'writer' | 'reader';

export type Permission =
  | 'createContainer'      // GlobalAdmin only
  | 'deleteContainer'       // GlobalAdmin, or UserAdmin on assigned containers
  | 'createContainerType'  // GlobalAdmin only
  | 'createApp'            // GlobalAdmin only
  | 'deleteApp'            // GlobalAdmin only
  | 'assignPermission'     // GlobalAdmin or UserAdmin (on assigned containers)
  | 'manageAllUsers'       // GlobalAdmin only
  | 'manageNormalUsers'    // GlobalAdmin or UserAdmin
  | 'assignNormalUserRole' // GlobalAdmin or UserAdmin
  | 'assignAdminRole'      // GlobalAdmin only
  | 'manageAllApps'        // GlobalAdmin only
  | 'viewAuditLogs'        // GlobalAdmin or UserAdmin
  | 'overridePermissions'; // GlobalAdmin only

interface RBACContextType {
  role: AppRole;
  trueRole: AppRole;
  setRole: (r: AppRole) => boolean;
  can: (action: Permission) => boolean;
  maxAssignableContainerRole: () => ContainerRole;
  assignableRoles: (targetCurrentRole?: AppRole) => AppRole[];
  currentUser: { displayName: string; email: string } | null;
  hasPermission: (type: string, action: string) => boolean;
}

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  GlobalAdmin: [
    'createContainer',
    'createContainerType',
    'createApp',
    'deleteApp',
    'assignPermission',
    'manageAllUsers',
    'manageNormalUsers',
    'assignNormalUserRole',
    'assignAdminRole',
    'manageAllApps',
    'viewAuditLogs',
    'overridePermissions',
    'deleteContainer',
  ],
  UserAdmin: [
    'assignPermission',
    'manageNormalUsers',
    'assignNormalUserRole',
    'viewAuditLogs',
    'deleteContainer',
  ],
  NormalUser: [],
};

const RBACContext = createContext<RBACContextType>({
  role: 'NormalUser',
  trueRole: 'NormalUser',
  setRole: () => false,
  can: () => false,
  maxAssignableContainerRole: () => 'reader',
  assignableRoles: () => [],
  currentUser: null,
  hasPermission: () => false,
});

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trueRole, setTrueRole] = useState<AppRole>('NormalUser');
  const [activeRole, setActiveRole] = useState<AppRole>('NormalUser');
  const [currentUser, setCurrentUser] = useState<{ displayName: string; email: string } | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const user = getCurrentUser();
        if (user && user.email) {
          setCurrentUser({ displayName: user.name || user.email, email: user.email });
          let userRole: AppRole = 'NormalUser';
          if (user.role === 'GlobalAdmin') {
            userRole = 'GlobalAdmin';
          } else if (user.role === 'UserAdmin') {
            userRole = 'UserAdmin';
          } else {
            userRole = 'NormalUser';
          }
          setTrueRole(userRole);
          const stored = localStorage.getItem('simulatedRole') as AppRole;
          const canSwitchToStored = stored && checkCanSwitch(userRole, stored);
          setActiveRole(canSwitchToStored ? stored : userRole);
        } else {
          setCurrentUser(null);
          setTrueRole('NormalUser');
          setActiveRole('NormalUser');
        }
      } catch (err) {
        console.error('RBAC: Failed to load user role:', err);
        setTrueRole('NormalUser');
        setActiveRole('NormalUser');
      }
    };
    load();
    window.addEventListener('storage', load);
    const handleLogout = () => {
      console.log('[RBAC] Logout event received, resetting state');
      setCurrentUser(null);
      setTrueRole('NormalUser');
      setActiveRole('NormalUser');
      localStorage.removeItem('simulatedRole');
    };
    window.addEventListener('app-logout', handleLogout);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('app-logout', handleLogout);
    };
  }, []);

  const checkCanSwitch = (currentTrueRole: AppRole, target: AppRole): boolean => {
    console.log('[RBAC] checkCanSwitch: trueRole=' + currentTrueRole + ', target=' + target);
    if (target === currentTrueRole) return true;
    if (currentTrueRole === 'GlobalAdmin') return true;
    if (currentTrueRole === 'UserAdmin' && target === 'NormalUser') return true;
    return false;
  };

  const setRole = (r: AppRole): boolean => {
    console.log('[RBAC] setRole requested: ' + r);
    if (checkCanSwitch(trueRole, r)) {
      console.log('[RBAC] setRole approved: switching activeRole to ' + r);
      setActiveRole(r);
      localStorage.setItem('simulatedRole', r);
      return true;
    }
    console.warn('[RBAC] setRole denied: cannot switch from ' + trueRole + ' to ' + r);
    return false;
  };

  const can = (action: Permission): boolean =>
    ROLE_PERMISSIONS[activeRole]?.includes(action) ?? false;

  const maxAssignableContainerRole = (): ContainerRole => {
    if (activeRole === 'GlobalAdmin') return 'owner';
    if (activeRole === 'UserAdmin') return 'writer';
    return 'reader';
  };

  const assignableRoles = (targetCurrentRole?: AppRole): AppRole[] => {
    if (activeRole === 'GlobalAdmin') return ['GlobalAdmin', 'UserAdmin', 'NormalUser'];
    if (activeRole === 'UserAdmin') {
      if (targetCurrentRole === 'GlobalAdmin' || targetCurrentRole === 'UserAdmin') return [];
      return ['NormalUser'];
    }
    return [];
  };

  const hasPermission = (type: string, action: string): boolean => {
    if (activeRole === 'GlobalAdmin') return true;
    if (activeRole === 'UserAdmin' && type === 'user') return true;
    return false;
  };

  return (
    <RBACContext.Provider value={{
      role: activeRole,
      trueRole,
      setRole,
      can,
      maxAssignableContainerRole,
      assignableRoles,
      currentUser,
      hasPermission
    }}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = () => useContext(RBACContext);
'@

$path = "D:\my spec app\my-first-spe-app\src\context\RBACContext.tsx"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "File written successfully"
