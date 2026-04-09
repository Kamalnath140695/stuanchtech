import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { FileText, Upload, FolderOpen, Clock } from 'lucide-react';

interface RecentFile {
  id: number;
  name: string;
  container_name: string;
  size: number;
  created_at: string;
  type: string;
}

interface UserStats {
  totalFiles: number;
  totalContainers: number;
  storageUsed: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const UserHomePage: React.FC = () => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user-specific data
        const filesData = await apiFetch('/api/files/my-recent');
        setRecentFiles(filesData.files || filesData || []);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getFileIcon = (type: string) => {
    return <FileText size={20} color="#64748b" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>My Dashboard</h1>
        <span style={{ fontSize: '13px', color: 'var(--phorexy-text-muted)' }}>
          Welcome back!
        </span>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div 
          style={{ 
            flex: 1, 
            background: 'var(--phorexy-card)', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid var(--phorexy-border)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} color="#0ea5e9" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Upload Files</div>
              <div style={{ color: 'var(--phorexy-text-muted)', fontSize: '12px' }}>Add new documents</div>
            </div>
          </div>
        </div>
        <div 
          style={{ 
            flex: 1, 
            background: 'var(--phorexy-card)', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid var(--phorexy-border)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={22} color="#10b981" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>My Containers</div>
              <div style={{ color: 'var(--phorexy-text-muted)', fontSize: '12px' }}>View all folders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Files */}
      <div style={{ background: 'var(--phorexy-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--phorexy-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Recent Files</h3>
          <span style={{ color: 'var(--phorexy-accent)', fontSize: '13px', cursor: 'pointer' }}>View All</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--phorexy-text-muted)' }}>
            Loading...
          </div>
        ) : recentFiles.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentFiles.slice(0, 5).map((file) => (
              <div 
                key={file.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  background: 'var(--phorexy-card-hover)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {getFileIcon(file.type)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--phorexy-text-muted)' }}>
                    {file.container_name} • {formatBytes(file.size)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--phorexy-text-muted)', fontSize: '12px' }}>
                  <Clock size={14} />
                  {new Date(file.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--phorexy-text-muted)' }}>
            No recent files. Upload your first document!
          </div>
        )}
      </div>
    </div>
  );
};

export default UserHomePage;
