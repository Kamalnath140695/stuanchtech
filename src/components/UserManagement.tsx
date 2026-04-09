import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Input, Label, Spinner, Badge, Select,
  Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, TableCellLayout,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  makeStyles,
} from '@fluentui/react-components';
import { AddRegular, DeleteRegular, PersonRegular, EditRegular, InfoRegular } from '@fluentui/react-icons';
import { apiFetch, logAudit } from '../services/api';
import { useRBAC, AppRole } from '../context/RBACContext';

const ALL_ROLES: AppRole[] = ['GlobalAdmin', 'UserAdmin', 'NormalUser'];

interface IUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  accountEnabled?: boolean;
  createdDateTime?: string;
  roleSource?: 'local' | 'graph';
}

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', rowGap: '24px' },
  dialogGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' },
});

const PermissionBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <div style={{ padding: '14px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
    <InfoRegular style={{ color: '#d97706', fontSize: '20px', flexShrink: 0, marginTop: '1px' }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, color: '#92400e', fontSize: '13px', marginBottom: '6px' }}>
        ⚠️ Role saved locally — Azure AD not updated
      </div>
      <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.6' }}>
        Your app registration is missing <strong>User.ReadWrite.All</strong> (Application permission). Roles are stored locally only.
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#92400e', background: '#fef3c7', borderRadius: '6px', padding: '8px 10px', lineHeight: '1.7' }}>
        <strong>To fix:</strong> Azure Portal → App registrations → your API app → API permissions → Add permission → Microsoft Graph → Application permissions → <code style={{ background: '#fde68a', padding: '1px 4px', borderRadius: '3px' }}>User.ReadWrite.All</code> → Grant admin consent → Restart backend.
      </div>
    </div>
    <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '16px', padding: 0 }}>✕</button>
  </div>
);

const UserManagement = () => {
  const styles = useStyles();
  const { can, role: actorRole, assignableRoles } = useRBAC();
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPermBanner, setShowPermBanner] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ displayName: '', userPrincipalName: '', department: '', role: (actorRole === 'GlobalAdmin' ? 'UserAdmin' : 'NormalUser') as AppRole });
  const [tempPassword, setTempPassword] = useState('');

  const [roleUser, setRoleUser] = useState<IUser | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('UserAdmin');
  const [assigningRole, setAssigningRole] = useState(false);

  const loadUsers = useCallback(async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/users${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setUsers(Array.isArray(data) ? data : data.value ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 400);
    return () => clearTimeout(t);
  }, [search, loadUsers]);

  const handleCreate = async () => {
    if (!form.displayName || !form.userPrincipalName) return;
    // GlobalAdmin can create any role; UserAdmin can only create NormalUser
    const allowedRoles = assignableRoles();
    if (!allowedRoles.includes(form.role)) {
      setError(`You do not have permission to create a user with role "${form.role}".`);
      return;
    }
    setCreating(true);
    setError('');
    try {
      const result = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) });
      setTempPassword(result.tempPassword || '');
      setSuccess(`User "${result.displayName}" created.`);
      setForm({ displayName: '', userPrincipalName: '', department: '', role: (actorRole === 'GlobalAdmin' ? 'UserAdmin' : 'NormalUser') as AppRole });
      await loadUsers();
      logAudit('CREATE_USER', form.userPrincipalName, `Role: ${form.role}`);
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  };

  const handleDelete = async (user: IUser) => {
    if (!window.confirm(`Delete user "${user.displayName}"?`)) return;
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      setSuccess(`User "${user.displayName}" deleted.`);
      logAudit('DELETE_USER', user.userPrincipalName);
      await loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const handleAssignRole = async () => {
    if (!roleUser) return;
    const targetCurrentRole = (ALL_ROLES.includes(roleUser.jobTitle as AppRole) ? roleUser.jobTitle : 'NormalUser') as AppRole;
    const allowed = assignableRoles(targetCurrentRole);
    if (!allowed.includes(newRole)) {
      setError(`You do not have permission to assign role "${newRole}" to this user.`);
      return;
    }
    setAssigningRole(true);
    setError('');
    try {
      const result = await apiFetch(`/api/users/${roleUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (result.graphUpdated === false) {
        setShowPermBanner(true);
        setSuccess(`Role "${newRole}" saved locally for ${roleUser.displayName}. Azure AD not updated — see warning.`);
      } else {
        setSuccess(`Role "${newRole}" assigned to ${roleUser.displayName} in Azure AD.`);
      }
      logAudit('ASSIGN_ROLE', roleUser.userPrincipalName, `Role: ${newRole}`);
      setRoleUser(null);
      await loadUsers();
    } catch (e: any) { setError(e.message); }
    setAssigningRole(false);
  };

  // Determine display role — only show known roles, otherwise show jobTitle as-is
  const displayRole = (jobTitle?: string) =>
    ALL_ROLES.includes(jobTitle as AppRole) ? jobTitle : jobTitle || '—';

  const roleBadgeColor = (jobTitle?: string): 'danger' | 'informative' | 'subtle' =>
    jobTitle === 'GlobalAdmin' ? 'danger' : jobTitle === 'UserAdmin' ? 'informative' : 'subtle';

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>User Management</h2>
        {can('manageNormalUsers') && (
          <Button appearance="primary" icon={<AddRegular />} onClick={() => { setCreateOpen(true); setTempPassword(''); setError(''); }}>
            Create User
          </Button>
        )}
      </div>

      {showPermBanner && <PermissionBanner onDismiss={() => setShowPermBanner(false)} />}

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#16a34a', fontSize: '13px' }}>
          {success}
        </div>
      )}

      <Input
        placeholder="Search users by name or email..."
        value={search}
        onChange={(_, d) => setSearch(d.value)}
        style={{ maxWidth: '360px' }}
      />

      {loading ? (
        <Spinner size="medium" label="Loading users..." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Email / UPN</TableHeaderCell>
              <TableHeaderCell>Department</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {can('assignPermission') && <TableHeaderCell>Actions</TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users
              .filter(u => {
                if (actorRole === 'GlobalAdmin') return true;
                if (actorRole === 'UserAdmin') {
                   // UserAdmin only sees Normal Users or users with no jobTitle (defaulting to Normal)
                   const r = (u.jobTitle || 'NormalUser') as AppRole;
                   return r === 'NormalUser';
                }
                return false; // NormalUsers shouldn't even see this page
              })
              .map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <TableCellLayout media={<PersonRegular />}>{u.displayName}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <span style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)' }}>{u.userPrincipalName}</span>
                </TableCell>
                <TableCell>{u.department || '—'}</TableCell>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge appearance="filled" color={roleBadgeColor(u.jobTitle)}>
                      {displayRole(u.jobTitle)}
                    </Badge>
                    {u.roleSource === 'local' && (
                      <span title="Stored locally — not in Azure AD" style={{ fontSize: '10px', color: '#d97706', cursor: 'help' }}>⚠ local</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge appearance="outline" color={u.accountEnabled ? 'success' : 'subtle'}>
                    {u.accountEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                {can('assignPermission') && (
                  <TableCell>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(() => {
                        const targetRole = (ALL_ROLES.includes(u.jobTitle as AppRole) ? u.jobTitle : 'NormalUser') as AppRole;
                        const canChangeRole = assignableRoles(targetRole).length > 0;
                        return canChangeRole ? (
                          <Button size="small" appearance="subtle" icon={<EditRegular />}
                            onClick={() => { setRoleUser(u); setNewRole(ALL_ROLES.includes(u.jobTitle as AppRole) ? u.jobTitle as AppRole : 'NormalUser'); setError(''); }}>
                            Role
                          </Button>
                        ) : null;
                      })()}
                      {can('manageAllUsers') && (
                        <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => handleDelete(u)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: 'center', color: 'var(--phorexy-text-muted)', padding: '32px' }}>
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={(_, d) => setCreateOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Create New User</DialogTitle>
            <DialogContent>
              {tempPassword ? (
                <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', marginTop: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: '8px' }}>✅ User created successfully!</div>
                  <div style={{ fontSize: '13px' }}>
                    Temporary password:{' '}
                    <code style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '14px' }}>{tempPassword}</code>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>User must change password on first sign-in.</div>
                </div>
              ) : (
                <div className={styles.dialogGrid}>
                  <div>
                    <Label>Display Name *</Label>
                    <Input value={form.displayName} onChange={(_, d) => setForm(f => ({ ...f, displayName: d.value }))} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label>User Principal Name *</Label>
                    <Input value={form.userPrincipalName} onChange={(_, d) => setForm(f => ({ ...f, userPrincipalName: d.value }))} placeholder="john@tenant.com" />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Input value={form.department} onChange={(_, d) => setForm(f => ({ ...f, department: d.value }))} placeholder="Engineering" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={form.role} onChange={(_, d) => setForm(f => ({ ...f, role: d.value as AppRole }))}>
                      {assignableRoles().map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </div>
                  {error && <div style={{ gridColumn: '1/-1', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" onClick={() => setTempPassword('')}>Close</Button>
              </DialogTrigger>
              {!tempPassword && (
                <Button appearance="primary" onClick={handleCreate} disabled={creating || !form.displayName || !form.userPrincipalName}>
                  {creating ? <Spinner size="tiny" /> : 'Create User'}
                </Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={!!roleUser} onOpenChange={(_, d) => { if (!d.open) setRoleUser(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div style={{ fontSize: '14px' }}>User: <strong>{roleUser?.displayName}</strong></div>
                <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)' }}>{roleUser?.userPrincipalName}</div>
                <div>
                  <Label>New Role</Label>
                  <Select value={newRole} onChange={(_, d) => setNewRole(d.value as AppRole)}>
                    {assignableRoles(
                      (ALL_ROLES.includes(roleUser?.jobTitle as AppRole) ? roleUser?.jobTitle : 'NormalUser') as AppRole
                    ).map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  {assignableRoles(
                    (ALL_ROLES.includes(roleUser?.jobTitle as AppRole) ? roleUser?.jobTitle : 'NormalUser') as AppRole
                  ).length === 0 && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
                      You do not have permission to change this user's role.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)', background: 'var(--phorexy-card-hover)', padding: '10px', borderRadius: '6px', lineHeight: '1.7' }}>
                  <strong style={{ color: '#ef4444' }}>GlobalAdmin</strong> — Full system access: create containers, manage all users.<br />
                  <strong style={{ color: '#0ea5e9' }}>UserAdmin</strong> — Manage assigned containers and normal users.<br />
                  <strong style={{ color: '#10b981' }}>NormalUser</strong> — Consumes assigned containers. No admin rights.
                </div>
                <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '8px 10px' }}>
                  ℹ️ Requires <code>User.ReadWrite.All</code> permission. If missing, role is saved locally only.
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setRoleUser(null)}>Cancel</Button>
              <Button appearance="primary" onClick={handleAssignRole} disabled={assigningRole}>
                {assigningRole ? <Spinner size="tiny" /> : 'Assign Role'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default UserManagement;
