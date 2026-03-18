import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verification step
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Debounced username check
  const checkUsername = useCallback(async (u: string) => {
    if (u.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const data = await api.checkUsername(u);
      setUsernameAvailable(data.available);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !password) {
      toast.error('All fields are required');
      return;
    }
    if (usernameAvailable === false) {
      toast.error('Username is taken');
      return;
    }
    setLoading(true);
    try {
      await signup(email, username, password);
      setShowVerification(true);
      toast.success('Check your email for the verification code');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      toast.error('Enter the verification code');
      return;
    }
    setLoading(true);
    try {
      await api.verifyEmail({ email, code: verificationCode });
      toast.success('Email verified!');
      navigate('/onboarding');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
        <div className="bio-logo">BIO.<br />LINK</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>Login</a>
        </div>
      </header>

      {/* Form */}
      <div style={{ maxWidth: 440, margin: '60px auto', padding: '0 20px' }} className="slide-up">
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Create your account</h1>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            className="input-field"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={showVerification}
          />

          {/* Username with bio.link/ prefix */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: 16 }}
              placeholder="bio.link/username"
              value={username ? `bio.link/${username}` : ''}
              onChange={(e) => {
                const val = e.target.value.replace('bio.link/', '');
                setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              }}
              disabled={showVerification}
            />
            {username && !checkingUsername && usernameAvailable !== null && (
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                }}
              >
                {usernameAvailable ? '✅' : '❌'}
              </span>
            )}
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field"
              placeholder="Password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={showVerification}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: '#6b7280',
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Verification code */}
          {showVerification && (
            <div className="fade-in">
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Paste login code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Resend
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                Enter the 6-digit code we sent to your email.<br />
                If you don't see it, check your spam folder.
              </p>
            </div>
          )}

          {/* Submit button */}
          {!showVerification ? (
            <button type="submit" className="btn-gradient" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'SIGNING UP...' : 'SIGN UP WITH EMAIL'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-gradient"
              onClick={handleVerify}
              disabled={loading}
              style={{ width: '100%', marginTop: 8, opacity: verificationCode.length < 6 ? 0.5 : 1 }}
            >
              {loading ? 'VERIFYING...' : 'SIGN UP WITH EMAIL'}
            </button>
          )}
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Or</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        {/* Social buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-outline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Sign up with Facebook
          </button>
          <button className="btn-outline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            Sign up with Apple
          </button>
        </div>

        {/* Terms */}
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>
          By signing up, you agree to our{' '}
          <a href="#" style={{ color: '#6b7280', textDecoration: 'underline' }}>Terms of Service</a>
          {' '}and{' '}
          <a href="#" style={{ color: '#6b7280', textDecoration: 'underline' }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
