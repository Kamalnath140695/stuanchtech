import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRBAC } from '../context/RBACContext';
import { DMSUser, PermissionCreate, PermissionResponse } from '../types';
import { getToken } from '../services/api';
import { Button, Table, Modal, Select, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;

const PermissionManagement: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newPermission, setNewPermission] = useState<PermissionCreate>({
    permission_type: 'container',
    permission_action: 'create',
    resource_id: ''
  });
  const [users, setUsers] = useState<DMSUser[]>([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { hasPermission } = useRBAC();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadPermissions();
    loadUsers();
  }, [currentUser, navigate]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch('/api/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load permissions');
      const data = await response.json();
      setPermissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    }
  };

  const createPermission = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPermission)
      });
      if (!response.ok) throw new Error('Failed to create permission');
      await loadPermissions();
      setShowModal(false);
      setNewPermission({ permission_type: 'container', permission_action: 'create', resource_id: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePermission = async (permissionId: number) => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch(`/api/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete permission');
      await loadPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission('user', 'read')) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="You don't have permission to view this page" type="error" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Permission Management</h2>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          style={{ marginBottom: '20px' }}
          onClose={() => setError('')}
          closable
        />
      )}

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowModal(true)}
          disabled={!hasPermission('user', 'create')}
        >
          Create Permission
        </Button>
      </div>

      <Table
        loading={loading}
        dataSource={permissions}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      >
        <Table.Column title="User" dataIndex="user_id" />
        <Table.Column title="Type" dataIndex="permission_type" />
        <Table.Column title="Action" dataIndex="permission_action" />
        <Table.Column title="Resource" dataIndex="resource_id" />
        <Table.Column
          title="Actions"
          key="actions"
          render={(_, record: PermissionResponse) => (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => deletePermission(record.id)}
              disabled={!hasPermission('user', 'delete')}
            >
              Delete
            </Button>
          )}
        />
      </Table>

      <Modal
        title="Create Permission"
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          setNewPermission({ permission_type: 'container', permission_action: 'create', resource_id: '' });
          setError('');
        }}
        onOk={createPermission}
        confirmLoading={loading}
        okText="Create"
        cancelText="Cancel"
      >
        <div>
          <label>User:</label>
          <Select
            style={{ width: '100%', marginBottom: '16px' }}
            value={newPermission.resource_id}
            onChange={(value) => setNewPermission(prev => ({ ...prev, resource_id: value }))}
          >
            {users.map((user: any) => (
              <Option key={user.id} value={user.id}>
                {user.email}
              </Option>
            ))}
          </Select>

          <label>Type:</label>
          <Select
            style={{ width: '100%', marginBottom: '16px' }}
            value={newPermission.permission_type}
            onChange={(value) => setNewPermission(prev => ({ ...prev, permission_type: value }))}
          >
            <Option value="container">Container</Option>
            <Option value="app">App</Option>
            <Option value="user">User</Option>
          </Select>

          <label>Action:</label>
          <Select
            style={{ width: '100%', marginBottom: '16px' }}
            value={newPermission.permission_action}
            onChange={(value) => setNewPermission(prev => ({ ...prev, permission_action: value }))}
          >
            <Option value="create">Create</Option>
            <Option value="read">Read</Option>
            <Option value="update">Update</Option>
            <Option value="delete">Delete</Option>
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default PermissionManagement;