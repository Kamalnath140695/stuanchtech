import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Input, Label, Spinner, Badge,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  makeStyles,
} from '@fluentui/react-components';
import { AddRegular, DeleteRegular, FolderRegular, StorageRegular, PersonRegular, LockClosedRegular, ShieldCheckmarkRegular, AppGenericRegular } from '@fluentui/react-icons';
import { apiFetch, formatBytes, logAudit } from '../services/api';
import { useRBAC } from '../context/RBACContext';
import { Files } from './files';
import { IContainer } from '../common/IContainer';
import ContainerRoleHelp from './ContainerRoleHelp';
import { FILE_STORAGE_CONTAINER_ROLES, FileStorageContainerRole } from '../common/containerRoleInfo';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', rowGap: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: {
    background: 'var(--phorexy-card)',
    border: '1px solid var(--phorexy-border)',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dialogGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' },
});

interface ContainerWithMeta extends IContainer {
  description?: string;
  containerTypeId: string;
  createdDateTime?: string;
  userRole?: string;
  storageUsed?: number;
  fileCount?: number;
}

const CONTAINER_LIMIT = 5;

const Containers = () => {
  const styles = useStyles();
  const { can, maxAssignableContainerRole } = useRBAC();
  const [containers, setContainers] = useState<ContainerWithMeta[]>([]);
  const [selected, setSelected] = useState<ContainerWithMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState<'grid' | 'files'>('grid');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ displayName: '', description: '' });

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<ContainerWithMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<ContainerWithMeta | null>(null);
  const [assignForm, setAssignForm] = useState({ upnOrAppId: '', role: 'reader' as FileStorageContainerRole, type: 'user' as 'user' | 'app' });
  const [assigning, setAssigning] = useState(false);

  const atLimit = containers.length >= CONTAINER_LIMIT;

  const loadContainers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/listContainers');
      setContainers(Array.isArray(data) ? data : data.value ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadContainers(); }, [loadContainers]);

  const handleCreate = async () => {
    if (!form.displayName) return;
    setCreating(true);
    setError('');
    try {
      const result = await apiFetch('/api/createContainer', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess(`Container "${result.displayName}" created.`);
      setForm({ displayName: '', description: '' });
      setCreateOpen(false);
      logAudit('CREATE_CONTAINER', form.displayName);
      await loadContainers();
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  };

  const handleDelete = async (c: ContainerWithMeta) => {
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/api/container/${c.id}`, { method: 'DELETE' });
      setSuccess(`Container "${c.displayName}" deleted. You can now create a new container.`);
      if (selected?.id === c.id) { setSelected(null); setView('grid'); }
      logAudit('DELETE_CONTAINER', c.displayName);
      setDeleteTarget(null);
      await loadContainers();
    } catch (e: any) { setError(e.message); }
    setDeleting(false);
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignForm.upnOrAppId) return;
    setAssigning(true);
    setError('');
    try {
      const endpoint = assignForm.type === 'app' 
        ? `/api/containers/${assignTarget.id}/app-permissions`
        : `/api/apps/container-permission`;
      
      const payload = assignForm.type === 'app' 
        ? {
            appId: assignForm.upnOrAppId,
            roles: [assignForm.role]
          }
        : {
            containerId: assignTarget.id,
            appObjectId: '',  // Not needed for user
            userPrincipalName: assignForm.upnOrAppId,
            role: assignForm.role
          };
      
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      setSuccess(`${assignForm.type === 'user' ? 'User' : 'App'} "${assignForm.upnOrAppId}" assigned to "${assignTarget.displayName}" as ${assignForm.role}.`);
      setAssignTarget(null);
      setAssignForm({ upnOrAppId: '', role: 'reader', type: 'user' });
      logAudit('ASSIGN_CONTAINER_PERMISSION', assignTarget.displayName, `${assignForm.upnOrAppId} (${assignForm.type}) -> ${assignForm.role}`);
    } catch (e: any) { setError(e.message); }
    setAssigning(false);
  };

  if (view === 'files' && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button appearance="subtle" onClick={() => { setView('grid'); setSelected(null); }}>← Back to Containers</Button>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>{selected.displayName}</span>
          <Badge appearance="outline">{formatBytes(selected.storageUsed || 0)} used</Badge>
        </div>
        <Files container={selected} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Container Management</h2>
        {can('createContainer') && (
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => { setError(''); setCreateOpen(true); }}
            disabled={atLimit}
            title={atLimit ? `Limit reached: max ${CONTAINER_LIMIT} containers. Delete one to free a slot.` : ''}
          >
            New Container
          </Button>
        )}
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#16a34a', fontSize: '13px' }}>{success}</div>}

      {loading ? (
        <Spinner size="medium" label="Loading containers..." />
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>{containers.length} assigned container{containers.length !== 1 ? 's' : ''}</div>
          <div className={styles.grid}>
            {containers.map(c => (
              <div
                key={c.id}
                className={styles.card}
                style={{ borderColor: selected?.id === c.id ? 'var(--phorexy-accent)' : 'var(--phorexy-border)' }}
                onClick={() => { setSelected(c); setView('files'); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderRegular style={{ color: '#0ea5e9', fontSize: '20px' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{c.displayName}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                         <Badge size="tiny" appearance="filled" color={
                           (c.userRole === 'owner' || can('createContainer')) ? 'danger' : 
                           (c.userRole === 'writer' || c.userRole === 'write' || c.userRole === 'manager') ? 'informative' : 'subtle'
                         }>
                            {(c.userRole || (can('createContainer') ? 'owner' : 'reader'))}
                         </Badge>
                         <span style={{ fontSize: '10px', color: 'var(--phorexy-text-muted)' }}>ID: {c.id?.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {can('assignPermission') && (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<LockClosedRegular />}
                        title="Assign permissions"
                        onClick={e => { e.stopPropagation(); setAssignTarget(c); }}
                      />
                    )}
                    {can('deleteContainer') && (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        style={{ color: '#ef4444' }}
                        title="Delete container"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                      />
                    )}
                  </div>
                </div>

                {c.description && (
                  <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)' }}>{c.description}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: 'var(--phorexy-card-hover)', borderRadius: '8px', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)' }}>Storage Used</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{formatBytes(c.storageUsed || 0)}</div>
                  </div>
                  <div style={{ background: 'var(--phorexy-card-hover)', borderRadius: '8px', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)' }}>Files</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{c.fileCount ?? 0}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {c.createdDateTime && (
                    <div style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)' }}>
                      Created: {new Date(c.createdDateTime).toLocaleDateString()}
                    </div>
                  )}
                  <Button size="small" appearance="subtle" style={{ minWidth: 'auto', padding: '0 8px' }} onClick={() => { setSelected(c); setView('files'); }}>
                    Open →
                  </Button>
                </div>
              </div>
            ))}
            {containers.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: 'var(--phorexy-text-muted)' }}>
                <StorageRegular style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }} />
                <div>No containers found. Create one to get started.</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(_, d) => { if (!d.open) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Container</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>⚠ This action is permanent</div>
                  <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                    All files inside <strong>{deleteTarget?.displayName}</strong> will be permanently deleted.
                    This cannot be undone.
                  </div>
                </div>
                {atLimit && (
                  <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', color: '#166534' }}>
                    ✅ Deleting this container will free a slot, allowing you to create a new one.
                  </div>
                )}
                <div style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>
                  Container: <strong>{deleteTarget?.displayName}</strong><br />
                  Storage used: <strong>{formatBytes(deleteTarget?.storageUsed || 0)}</strong> · Files: <strong>{deleteTarget?.fileCount ?? 0}</strong>
                </div>
                {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button
                appearance="primary"
                style={{ background: '#dc2626', border: 'none' }}
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
                disabled={deleting}
              >
                {deleting ? <Spinner size="tiny" /> : 'Delete Permanently'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Create Container Dialog */}
      <Dialog open={createOpen} onOpenChange={(_, d) => setCreateOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Create Storage Container</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div>
                  <Label>Container Name *</Label>
                  <Input
                    value={form.displayName}
                    onChange={(_, d) => setForm(f => ({ ...f, displayName: d.value }))}
                    placeholder="My Container"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))}
                    placeholder="Optional description"
                    style={{ width: '100%' }}
                  />
                </div>
                {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleCreate} disabled={creating || !form.displayName}>
                {creating ? <Spinner size="tiny" /> : 'Create Container'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {/* Container Assignment Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(_, d) => { if (!d.open) setAssignTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Assign Container Access</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div style={{ padding: '10px 12px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', fontSize: '13px' }}>
                   You are assigning access to <strong>{assignTarget?.displayName}</strong>
                </div>
                
                <div>
                  <Label>{assignForm.type === 'user' ? 'User Principal Name (UPN) *' : 'Client Application ID *'}</Label>
                  <Input
                    contentBefore={assignForm.type === 'user' ? <PersonRegular /> : <AppGenericRegular />}
                    value={assignForm.upnOrAppId}
                    onChange={(_, d) => setAssignForm(f => ({ ...f, upnOrAppId: d.value }))}
                    placeholder={assignForm.type === 'user' ? 'user@tenant.onmicrosoft.com' : '00000000-0000-0000-0000-000000000000'}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <Label>Assign Rights</Label>
                    <ContainerRoleHelp
                      roles={
                        maxAssignableContainerRole() === 'owner'
                          ? ['reader', 'writer', 'manager', 'owner']
                          : maxAssignableContainerRole() === 'writer'
                            ? ['reader', 'writer']
                            : ['reader']
                      }
                    />
                  </div>
                  <select
                    style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--phorexy-border)', marginTop: '4px', background: 'var(--phorexy-card)', color: 'var(--phorexy-text)', cursor: 'pointer' }}
                    value={assignForm.role}
                    onChange={e => setAssignForm(f => ({ ...f, role: e.target.value as FileStorageContainerRole }))}
                  >
                    <option value="reader">{FILE_STORAGE_CONTAINER_ROLES.reader.dropdownLabel}</option>
                    {(maxAssignableContainerRole() === 'writer' || maxAssignableContainerRole() === 'owner') && (
                      <option value="writer">{FILE_STORAGE_CONTAINER_ROLES.writer.dropdownLabel}</option>
                    )}
                    {maxAssignableContainerRole() === 'owner' && (
                      <>
                        <option value="manager">{FILE_STORAGE_CONTAINER_ROLES.manager.dropdownLabel}</option>
                        <option value="owner">{FILE_STORAGE_CONTAINER_ROLES.owner.dropdownLabel}</option>
                      </>
                    )}
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--phorexy-text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                    {FILE_STORAGE_CONTAINER_ROLES[assignForm.role].description}
                  </div>
                </div>
                {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setAssignTarget(null)} disabled={assigning}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={handleAssign}
                disabled={assigning || !assignForm.upnOrAppId}
                icon={<ShieldCheckmarkRegular />}
              >
                {assigning ? <Spinner size="tiny" /> : 'Assign Access'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default Containers;
