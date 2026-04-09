import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { loginRedirect, loginWithGoogleRedirect } from '../services/authService';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'microsoft' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const lastAuthError = sessionStorage.getItem('last_auth_error');
    if (lastAuthError) {
      setError(`Microsoft sign-in failed: ${lastAuthError}`);
    }
  }, []);

  const persistSSOUser = (result: {
    id?: number;
    email: string;
    name: string;
    role?: string;
    dashboard?: string;
    entraId?: string;
    is_guest?: boolean;
  }) => {
    const normalizedRole = result.role === 'GlobalAdmin' || result.role === 'UserAdmin'
      ? result.role
      : result.role === 'PendingApproval'
        ? 'PendingApproval'
        : result.role === 'GLOBAL_ADMIN'
          ? 'GlobalAdmin'
          : result.role === 'USER_ADMIN'
            ? 'UserAdmin'
            : 'NormalUser';

    localStorage.setItem('current_user', JSON.stringify({
      id: result.id || 0,
      entra_id: result.entraId || '',
      email: result.email,
      name: result.name,
      role: normalizedRole,
      created_date: new Date().toISOString(),
      is_guest: result.is_guest,
      dashboard: result.dashboard,
    }));
    localStorage.setItem('adminRole', normalizedRole);
    if (normalizedRole === 'PendingApproval') {
      sessionStorage.setItem('pending_approval', 'true');
    } else {
      sessionStorage.removeItem('pending_approval');
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('auth-state-changed'));
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      // Check if pending approval
      if (data.status === 'PENDING_APPROVAL') {
        localStorage.setItem('current_user', JSON.stringify(data.user));
        localStorage.setItem('adminRole', data.user.role);
        navigate('/login/pendingapprovaluser');
        return;
      }
      
      // Store user data for active users
      localStorage.setItem('current_user', JSON.stringify(data.user));
      localStorage.setItem('adminRole', data.user.role);
      
      // Redirect based on role
      const role = data.user.role;
      if (role === 'GlobalAdmin') {
        navigate('/globaladmin/homepage');
      } else if (role === 'UserAdmin') {
        navigate('/useradmin/homepage');
      } else {
        navigate('/user/homepage');
      }
    } catch (err: any) {
      console.error('[Login] Email login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  /**
   * Microsoft Login using redirect flow
   */
  const handleMicrosoftLogin = async () => {
    if (ssoLoading) return;
    setSsoLoading('microsoft');
    setError('');
    sessionStorage.removeItem('last_auth_error');
    
    try {
      console.log('[Login] Starting Microsoft redirect login...');
      
      // Use redirect flow - this will redirect to Microsoft and come back
      // The AuthCallback component will handle the response
      await loginRedirect();
      
      // NOTE: loginRedirect() causes a redirect, so code below won't execute
      
    } catch (err: any) {
      console.error('[Login] Microsoft login error:', err);
      setError(err.message || 'Microsoft login failed. Please try again.');
      setSsoLoading(null);
    }
  };

  /**
   * Google login uses popup flow
   */
  const handleGoogleLogin = async () => {
    if (ssoLoading) return;
    setSsoLoading('google');
    setError('');
    sessionStorage.removeItem('last_auth_error');
    
    try {
      loginWithGoogleRedirect();
    } catch (err: any) {
      console.error('[Login] Google login error:', err);
      setError(err.message || 'Google login failed. Please try again.');
      setSsoLoading(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    color: '#0f172a',
    background: '#f8fafc',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', margin: 0, padding: 0, width: '100%' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', color: 'white',
        padding: isMobile ? '0 16px' : '0 40px', height: isMobile ? '60px' : '70px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)', width: '100%', boxSizing: 'border-box',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          <ShieldCheck size={isMobile ? 24 : 32} color="#60a5fa" />
          <div>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 700 }}>StaunchTech</div>
            <div style={{ fontSize: isMobile ? '9px' : '11px', opacity: 0.8, letterSpacing: '1px' }}>DOCUMENT MANAGEMENT SYSTEM</div>
          </div>
        </div>
        <a href="/signup" style={{
          textDecoration: 'none', color: '#60a5fa', fontSize: isMobile ? '12px' : '14px',
          fontWeight: 600, padding: '8px 16px', borderRadius: '6px',
          border: '1px solid rgba(96,165,250,0.3)', transition: 'all 0.2s'
        }}>Create Account</a>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.97)', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', padding: isMobile ? '24px' : '40px',
          width: '100%', maxWidth: '440px', position: 'relative'
        }}>
          {/* Accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)', borderRadius: '16px 16px 0 0' }} />

          <div style={{ textAlign: 'center', marginBottom: '28px', marginTop: '8px' }}>
            <h1 style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>Welcome back</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Sign in to your account</p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <AlertCircle size={16} />{error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  autoComplete="current-password"
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  required
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
              padding: '13px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px'
            }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>

          {/* SSO Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleMicrosoftLogin} 
              disabled={!!ssoLoading} 
              style={{
                width: '100%', 
                background: 'linear-gradient(135deg, #0078d4, #005a9e)', 
                color: 'white',
                padding: '13px 20px', 
                borderRadius: '8px', 
                border: 'none', 
                fontSize: '14px', 
                fontWeight: 600,
                cursor: ssoLoading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center', 
                gap: '10px', 
                opacity: ssoLoading ? 0.7 : 1, 
                transition: 'all 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              {ssoLoading === 'microsoft' ? 'Redirecting...' : 'Continue with Microsoft'}
            </button>

            <button 
              onClick={handleGoogleLogin} 
              disabled={!!ssoLoading} 
              style={{
                width: '100%', 
                background: 'white', 
                color: '#333',
                padding: '13px 20px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0', 
                fontSize: '14px', 
                fontWeight: 600,
                cursor: ssoLoading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center', 
                gap: '10px', 
                opacity: ssoLoading ? 0.7 : 1, 
                transition: 'all 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {ssoLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
            Don't have an account?{' '}
            <a href="/signup" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Sign up <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </main>

      <footer style={{ background: 'rgba(255,255,255,0.95)', padding: isMobile ? '16px' : '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
        © 2024 StaunchTech Solutions. All rights reserved. | Terms & Conditions | Privacy Policy
      </footer>
    </div>
  );
};

export default Login;
