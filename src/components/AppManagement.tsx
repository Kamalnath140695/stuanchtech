import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Input, Label, Spinner, Badge, Select,
  Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, TableCellLayout,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  makeStyles,
  Combobox,
  Option,
} from '@fluentui/react-components';
import {
  AddRegular, DeleteRegular, AppGenericRegular, LinkRegular, ChevronDownRegular,
  PersonRegular, CheckmarkCircleRegular
} from '@fluentui/react-icons';
import { apiFetch, logAudit } from '../services/api';
import { useRBAC } from '../context/RBACContext';
import { IContainer } from '../common/IContainer';
import ContainerRoleHelp from './ContainerRoleHelp';
import {
  FILE_STORAGE_CONTAINER_ROLES,
  FileStorageContainerRole,
} from '../common/containerRoleInfo';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', rowGap: '24px' },
  row: { display: 'flex', flexDirection: 'row', columnGap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' },
});

interface IApp {
  id: string;
  appId: string;
  displayName: string;
  createdDateTime: string;
  signInAudience: string;
}

interface IUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

interface LinkedContainer extends IContainer {
  role: string;
  permissionId: string;
  grantedVia?: 'application' | 'user';
}

interface AssignmentSummary {
  assignedAppIds: string[];
  assignedUPNs: string[];
}

const APP_ASSIGNABLE_ROLE_ORDER: FileStorageContainerRole[] = ['reader', 'writer', 'owner'];

const AppManagement = () => {
  const styles = useStyles();
  const { can, currentUser } = useRBAC();
  const [apps, setApps] = useState<IApp[]>([]);
  const [containers, setContainers] = useState<IContainer[]>([]);
  const [orgUsers, setOrgUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AssignmentSummary>({ assignedAppIds: [], assignedUPNs: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [appName, setAppName] = useState('');
  const [creating, setCreating] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<IApp | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [assignUPN, setAssignUPN] = useState('');
  const [assignRole, setAssignRole] = useState<FileStorageContainerRole>('writer');
  const [assigning, setAssigning] = useState(false);

  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [linkedContainers, setLinkedContainers] = useState<Record<string, LinkedContainer[]>>({});
  const [loadingLinked, setLoadingLinked] = useState<string | null>(null);

  const loadAssignmentsSummary = useCallback(async () => {
    try {
      const data = await apiFetch('/api/apps/assignments-summary');
      setSummary(data);
    } catch {
      // Ignore summary load failures and keep the table usable.
    }
  }, []);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/apps/');
      setApps(Array.isArray(data) ? data : data.value ?? []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const loadContainers = useCallback(async () => {
    try {
      const data = await apiFetch('/api/listContainers');
      setContainers(Array.isArray(data) ? data : data.value ?? []);
    } catch {
      // Ignore container load failures here and let the existing error UI handle later actions.
    }
  }, []);

  const loadOrgUsers = useCallback(async () => {
    try {
      const data = await apiFetch('/api/users');
      setOrgUsers(Array.isArray(data) ? data : data.value ?? []);
    } catch {
      // Ignore user load failures here and allow manual UPN entry.
    }
  }, []);

  useEffect(() => {
    loadApps();
    loadContainers();
    loadOrgUsers();
    loadAssignmentsSummary();
  }, [loadApps, loadContainers, loadOrgUsers, loadAssignmentsSummary]);

  useEffect(() => {
    if (assignOpen && currentUser?.email) setAssignUPN(currentUser.email);
  }, [assignOpen, currentUser]);

  useEffect(() => {
    if (!assignOpen) return;
    if (selectedContainerId && containers.some((container) => container.id === selectedContainerId)) return;
    if (containers.length > 0) setSelectedContainerId(containers[0].id);
  }, [assignOpen, containers, selectedContainerId]);

  const handleCreate = async () => {
    if (!appName) return;
    setCreating(true);
    setError('');
    try {
      const result = await apiFetch('/api/apps/', { method: 'POST', body: JSON.stringify({ displayName: appName }) });
      setSuccess(`App "${result.app.displayName}" created. Client ID: ${result.app.appId}`);
      setAppName('');
      logAudit('CREATE_APP', appName, `appId: ${result.app.appId}`);
      await loadApps();
    } catch (e: any) {
      setError(e.message);
    }
    setCreating(false);
  };

  const handleDelete = async (app: IApp) => {
    if (!can('deleteApp')) {
      setError('Only Global Admins can delete app registrations.');
      return;
    }
    if (!window.confirm(`Delete app "${app.displayName}"?`)) return;
    try {
      await apiFetch(`/api/apps/?appObjectId=${encodeURIComponent(app.id)}`, { method: 'DELETE' });
      setSuccess(`App "${app.displayName}" deleted.`);
      logAudit('DELETE_APP', app.displayName);
      await loadApps();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAssign = async () => {
    if (!selectedApp || !selectedContainerId) return;
    setAssigning(true);
    setError('');
    try {
      const trimmedUPN = assignUPN.trim();
      // Use new direct container API (primary) + optional user assignment
      await apiFetch(`/api/containers/${selectedContainerId}/app-permissions`, {
        method: 'POST',
        body: JSON.stringify({
          appId: selectedApp.appId,
          roles: [assignRole]
        }),
      });
      
      // Optional user permission (if UPN provided)
      if (trimmedUPN) {
        await apiFetch('/api/apps/container-permission', {
          method: 'POST',
          body: JSON.stringify({
            containerId: selectedContainerId,
            appObjectId: selectedApp.id,
            userPrincipalName: trimmedUPN,
            role: assignRole,
          }),
        });
      }
      
      setSuccess(
        trimmedUPN
          ? `✅ Direct app permission assigned to container + ${trimmedUPN} user access granted.`
          : '✅ App directly assigned to specific container (new direct API).'
      );
      logAudit('ASSIGN_APP_CONTAINER_DIRECT', selectedApp.displayName, `containerId: ${selectedContainerId}, UPN: ${trimmedUPN || 'none'}, role: ${assignRole}`);
      setAssignOpen(false);
      setError('');
      loadAssignmentsSummary();
      if (expandedApp === selectedApp.appId) loadLinkedContainers(selectedApp.appId);
    } catch (e: any) {
      setError(e.message);
    }
    setAssigning(false);
  };

  const loadLinkedContainers = async (appId: string) => {
    setLoadingLinked(appId);
    try {
      const upnPart = currentUser?.email ? `?upn=${encodeURIComponent(currentUser.email)}` : '';
      const data = await apiFetch(`/api/apps/${appId}/containers${upnPart}`);
      setLinkedContainers(prev => ({ ...prev, [appId]: Array.isArray(data) ? data : [] }));
    } catch {
      setLinkedContainers(prev => ({ ...prev, [appId]: [] }));
    }
    setLoadingLinked(null);
  };

  const toggleExpand = (app: IApp) => {
    if (expandedApp === app.appId) {
      setExpandedApp(null);
    } else {
      setExpandedApp(app.appId);
      if (!linkedContainers[app.appId]) loadLinkedContainers(app.appId);
    }
  };

  const isCurrentlyAssigned = (app: IApp) => {
    if (linkedContainers[app.appId]?.length > 0) return true;
    if (summary.assignedAppIds.includes(app.appId)) return true;
    return false;
  };

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>App Registration Management</h2>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#16a34a', fontSize: '13px' }}>{success}</div>}

      {can('createApp') && (
        <div style={{ background: 'var(--phorexy-card)', border: '1px solid var(--phorexy-border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '14px' }}>Create New App Registration</div>
          <div className={styles.row}>
            <div>
              <Label>App Display Name</Label>
              <Input value={appName} onChange={(_, d) => setAppName(d.value)} placeholder="My Application" style={{ width: '280px' }} />
            </div>
            <Button appearance="primary" icon={<AddRegular />} onClick={handleCreate} disabled={creating || !appName}>
              {creating ? <Spinner size="tiny" /> : 'Create App'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner size="medium" label="Loading apps..." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Application</TableHeaderCell>
              <TableHeaderCell>Client ID</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Audience</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map(app => {
              const assigned = isCurrentlyAssigned(app);
              return (
                <React.Fragment key={app.id}>
                  <TableRow>
                    <TableCell>
                      <TableCellLayout media={<AppGenericRegular />}>{app.displayName}</TableCellLayout>
                    </TableCell>
                    <TableCell><code style={{ fontSize: '11px', background: 'var(--phorexy-card-hover)', padding: '2px 6px', borderRadius: '4px' }}>{app.appId}</code></TableCell>
                    <TableCell style={{ fontSize: '13px' }}>{new Date(app.createdDateTime).toLocaleDateString()}</TableCell>
                    <TableCell><Badge appearance="outline">{app.signInAudience}</Badge></TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button size="small" appearance="subtle" icon={<ChevronDownRegular />} onClick={() => toggleExpand(app)}>
                          {expandedApp === app.appId ? 'Hide' : 'Containers'}
                        </Button>
                        {(can('assignPermission') || can('deleteApp') || can('manageAllApps')) && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={assigned ? <CheckmarkCircleRegular style={{ color: '#16a34a' }} /> : <LinkRegular style={{ color: '#dc2626' }} />}
                            style={{ color: assigned ? '#16a34a' : '#dc2626', fontWeight: 600 }}
                            onClick={() => {
                              setSelectedApp(app);
                              setSelectedContainerId(containers[0]?.id ?? '');
                              setAssignOpen(true);
                            }}
                          >
                            {assigned ? 'Assigned' : 'Assign'}
                          </Button>
                        )}
                        {can('deleteApp') && (
                          <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => handleDelete(app)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedApp === app.appId && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div style={{ padding: '12px 16px', background: 'var(--phorexy-card-hover)', borderRadius: '8px', margin: '4px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: 'var(--phorexy-text-muted)' }}>Linked Containers</div>
                          {loadingLinked === app.appId ? (
                            <Spinner size="tiny" label="Loading..." />
                          ) : linkedContainers[app.appId]?.length ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {linkedContainers[app.appId].map(container => (
                                <div key={container.id} style={{ background: 'var(--phorexy-card)', border: '1px solid var(--phorexy-border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{container.displayName}</span>
                                  <Badge appearance="filled" color={container.role === 'owner' ? 'danger' : container.role === 'writer' || container.role === 'manager' ? 'warning' : 'informative'}>{container.role}</Badge>
                                  {container.grantedVia === 'user' && (
                                    <Badge appearance="outline" color="warning" size="small" icon={<PersonRegular />}>via User</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>No containers assigned to this app.</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {apps.length === 0 && (
              <TableRow><TableCell colSpan={5} style={{ textAlign: 'center', color: 'var(--phorexy-text-muted)', padding: '32px' }}>No app registrations found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={assignOpen} onOpenChange={(_, data) => setAssignOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Assign Container to App</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div style={{ fontSize: '14px' }}>App: <strong>{selectedApp?.displayName}</strong></div>
                <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)' }}>Client ID: {selectedApp?.appId}</div>
                <div>
                  <Label>Select Container</Label>
                  <select
                    style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--phorexy-border)', marginTop: '4px', background: 'var(--phorexy-card)', color: 'var(--phorexy-text)' }}
                    value={selectedContainerId}
                    onChange={e => setSelectedContainerId(e.target.value)}
                  >
                    <option value="" disabled>Select a container</option>
                    {containers.map(container => <option key={container.id} value={container.id}>{container.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <Label>User Principal Name (UPN)</Label>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: 'var(--phorexy-text-muted)' }}>
                    Optional. Provide a user UPN to also grant that user access to the selected container. Leave it blank to grant the app only.
                  </p>
                  {currentUser?.role === 'GlobalAdmin' ? (
                    <div style={{ padding: '8px 12px', background: 'var(--phorexy-card-hover)', borderRadius: '6px', fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>
                      This field is hidden for Global Admin users. Access is assigned directly to the container only.
                    </div>
                  ) : (
                    <Combobox
                      placeholder="Search or enter user email (optional)..."
                      freeform
                      value={assignUPN}
                      onOptionSelect={(_, data) => setAssignUPN(data.optionValue || '')}
                      onInput={(event: any) => setAssignUPN(event.target.value)}
                      style={{ width: '100%' }}
                    >
                      {orgUsers.map(user => (
                        <Option key={user.id} text={user.userPrincipalName} value={user.userPrincipalName}>
                          <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{user.displayName}</span>
                            <span style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)' }}>{user.userPrincipalName}</span>
                          </div>
                        </Option>
                      ))}
                    </Combobox>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <Label>Role</Label>
                    <ContainerRoleHelp />
                  </div>
                  <Select value={assignRole} onChange={(_, data) => setAssignRole(data.value as FileStorageContainerRole)}>
                    {APP_ASSIGNABLE_ROLE_ORDER.map(role => (
                      <option key={role} value={role}>
                        {FILE_STORAGE_CONTAINER_ROLES[role].dropdownLabel}
                      </option>
                    ))}
                  </Select>
                  <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                    {FILE_STORAGE_CONTAINER_ROLES[assignRole].description}
                    <div style={{ marginTop: '4px' }}>
                      This app assignment dialog supports Reader, Writer, and Owner. Use the info button to compare all container roles.
                    </div>
                  </div>
                </div>
                {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleAssign} disabled={assigning || !selectedApp || !selectedContainerId}>
                {assigning ? <Spinner size="tiny" /> : 'Assign Access'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default AppManagement;
