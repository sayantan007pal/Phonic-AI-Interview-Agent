import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { Mic, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name);
        toast.success('Account created!');
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-background)', backgroundImage: `url("${process.env.REACT_APP_LOGIN_BG || ''}")` }}
      data-testid="login-page"
    >
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 30% 70%, rgba(99,102,241,0.1) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 60% 40%, rgba(37,99,235,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg">
            <Mic size={20} color="white" />
          </div>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 24, color: 'var(--color-text-primary)' }}>
            Phonic
          </span>
        </div>

        {/* Card */}
        <div className="phonic-card">
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {isRegister ? 'Create account' : 'Sign in'}
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            {isRegister ? 'Start scheduling AI interviews' : 'AI-powered voice interview platform'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="phonic-input"
                  required
                  data-testid="register-name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="phonic-input"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="phonic-input pr-10"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isRegister && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Demo: <code className="font-mono">admin@phonic.ai</code> / <code className="font-mono">phonic123</code>
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center mt-6"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: 'var(--color-text-secondary)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="font-semibold"
              style={{ color: 'var(--color-accent-primary)' }}
              data-testid="toggle-auth-mode"
            >
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
