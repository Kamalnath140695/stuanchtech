import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { loginRedirect, loginWithGoogleRedirect } from '../services/authService';

const Signup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'microsoft' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMicrosoftSignup = async () => {
    if (loading || ssoLoading) return;
    setLoading(true);
    setError('');
    try {
      await loginRedirect();
    } catch (err: any) {
      console.error('Microsoft signup error:', err);
      setError(err.message || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (loading || ssoLoading) return;
    setSsoLoading('google');
    setError('');
    try {
      loginWithGoogleRedirect();
    } catch (err: any) {
      console.error('Google signup error:', err);
      setError(err.message || 'Sign up failed. Please try again.');
      setSsoLoading(null);
    }
  };

  const benefits = [
    { icon: ShieldCheck, title: 'Secure Storage', desc: 'Enterprise-grade security for your documents' },
    { icon: CheckCircle2, title: 'Easy Collaboration', desc: 'Share and collaborate with your team' },
    { icon: Mail, title: 'Email Notifications', desc: 'Stay updated with real-time alerts' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)', margin: 0, padding: 0, width: '100%' }}>
      <header style={{
        background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', color: 'white',
        padding: isMobile ? '0 16px' : '0 40px', height: isMobile ? '60px' : '70px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(15,23,42,0.15)', width: '100%', boxSizing: 'border-box',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          <ShieldCheck size={isMobile ? 24 : 32} color="#60a5fa" />
          <div>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 700 }}>StaunchTech</div>
            <div style={{ fontSize: isMobile ? '9px' : '11px', opacity: 0.8, letterSpacing: '1px' }}>DOCUMENT MANAGEMENT SYSTEM</div>
          </div>
        </div>
        <Link to="/login" style={{ textDecoration: 'none', color: '#94a3b8', fontSize: isMobile ? '12px' : '14px', fontWeight: 600, padding: '8px 16px', borderRadius: '6px' }}>Sign In</Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '32px' : '64px', alignItems: 'center', maxWidth: '1100px', width: '100%' }}>
          {!isMobile && (
            <div style={{ flex: 1, maxWidth: '460px' }}>
              <h1 style={{ fontSize: '42px', fontWeight: 800, margin: '0 0 20px 0', color: '#0f172a', lineHeight: 1.2 }}>
                Manage your documents with <span style={{ color: '#3b82f6' }}>confidence</span>
              </h1>
              <p style={{ fontSize: '17px', color: '#64748b', margin: '0 0 36px 0', lineHeight: 1.7 }}>
                Join thousands of professionals who trust StaunchTech for secure document management.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <b.icon size={22} color="#3b82f6" />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{b.title}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: isMobile ? 'none' : 1, maxWidth: '460px', width: '100%' }}>
            <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(15,23,42,0.12)', padding: isMobile ? '24px' : '36px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)' }} />

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>Sign up to get started</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Use your Microsoft or Google account to sign up</p>
              </div>

              {error && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <AlertCircle size={16} />{error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={handleMicrosoftSignup} disabled={loading} style={{
                  width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                  padding: '14px 20px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                  {loading ? 'Signing up...' : 'Sign Up with Microsoft'}
                </button>

                <button onClick={handleGoogleSignup} disabled={ssoLoading === 'google'} style={{
                  width: '100%', background: 'white', color: '#333',
                  padding: '14px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 600,
                  cursor: ssoLoading === 'google' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '10px', opacity: ssoLoading === 'google' ? 0.7 : 1,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {ssoLoading === 'google' ? 'Signing up...' : 'Continue with Google'}
                </button>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  Sign in <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: isMobile ? '16px' : '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
        © 2024 StaunchTech Solutions. All rights reserved. | Terms & Conditions | Privacy Policy
      </footer>
    </div>
  );
};

export default Signup;
