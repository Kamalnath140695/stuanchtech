import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getStorageWarning, clearStorageWarning } from '../services/authService';

const StorageWarningBanner = () => {
  const [warning, setWarning] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkWarning = () => {
      const storageWarning = getStorageWarning();
      if (storageWarning) {
        setWarning(storageWarning);
        setVisible(true);
      }
    };

    checkWarning();
    
    // Check periodically for new warnings
    const interval = setInterval(checkWarning, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    clearStorageWarning();
    setWarning(null);
  };

  if (!visible || !warning) {
    return null;
  }

  const isLocalStorage = warning.title.includes('Local Storage');
  const bgColor = isLocalStorage ? '#fef2f2' : '#fffbeb';
  const borderColor = isLocalStorage ? '#fca5a5' : '#fcd34d';
  const textColor = isLocalStorage ? '#dc2626' : '#d97706';
  const iconColor = isLocalStorage ? '#dc2626' : '#d97706';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: bgColor,
        borderBottom: `2px solid ${borderColor}`,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <AlertCircle size={24} color={iconColor} />
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: textColor, marginBottom: '4px' }}>
          {warning.title}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
          {warning.message}
        </div>
        {warning.details && (
          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
            Details: {warning.details}
          </div>
        )}
      </div>

      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <X size={20} color="#64748b" />
      </button>
    </div>
  );
};

export default StorageWarningBanner;
