import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Mail, LogOut } from 'lucide-react';
import { logout } from '../services/authService';

const PendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Header */}
      <header style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '0 40px',
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ShieldCheck size={32} color="#60a5fa" />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>StaunchTech</div>
            <div style={{ fontSize: '11px', opacity: 0.8, letterSpacing: '1px' }}>DOCUMENT MANAGEMENT SYSTEM</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '8px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.97)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        padding: '48px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)',
          borderRadius: '16px 16px 0 0'
        }} />

        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <Clock size={40} color="#f59e0b" />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          color: '#0f172a',
          margin: '0 0 12px 0'
        }}>
          Account Pending Approval
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          lineHeight: 1.6,
          margin: '0 0 32px 0'
        }}>
          Your account has been created successfully and is currently pending approval from an administrator.
          You will receive an email notification once your account has been approved.
        </p>

        {/* Info Box */}
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '1px solid #fbbf24',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <Mail size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                What happens next?
              </div>
              <div style={{ fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
                An administrator will review your account request. This typically takes 1-2 business days.
                Once approved, you'll receive an email with instructions to access the system.
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fef3c7',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#92400e'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#f59e0b',
            animation: 'blink 1.5s ease-in-out infinite'
          }} />
          Status: Pending Approval
        </div>

        {/* Help Text */}
        <p style={{
          fontSize: '13px',
          color: '#94a3b8',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e2e8f0'
        }}>
          Need help? Contact your administrator or email{' '}
          <a href="mailto:support@staunchtech.com" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            support@staunchtech.com
          </a>
        </p>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255,255,255,0.95)',
        padding: '20px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#64748b'
      }}>
        © 2024 StaunchTech Solutions. All rights reserved.
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default PendingApprovalPage;
