import { useState } from 'react'
import { supabase } from '../services/supabase'

const TEST_ACCOUNTS = [
  { label: 'Priya (Gold)', email: 'priya.nair@example.com', pass: 'Pass_123', tag: 'Cancelled' },
  { label: 'Arvind (Silver)', email: 'arvind.kulkarni@example.com', pass: 'Pass_123', tag: '4h Delay' },
  { label: 'Meher (Platinum)', email: 'meher.kaur@example.com', pass: 'Pass_123', tag: 'Fare Waiver' },
  { label: 'Supervisor (Admin)', email: 'admin@airline.com', pass: 'Pass_123', tag: 'Admin Portal' }
]

export function Login({ onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.')
      return
    }

    try {
      setLoading(true)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      })

      if (signInError) {
        if (
          signInError.message?.toLowerCase().includes('invalid login credentials') ||
          signInError.message?.toLowerCase().includes('invalid credentials')
        ) {
          setError('Invalid email or password. Please check credentials.')
        } else if (signInError.message?.toLowerCase().includes('email not confirmed')) {
          setError('Email address has not been confirmed yet. Please verify.')
        } else {
          setError(signInError.message || 'Login failed. Please try again.')
        }
        return
      }

      console.log('[Login] Sign in successful:', data?.user?.id)
    } catch (err) {
      console.error('[Login] Unexpected error during sign in:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (acc) => {
    setEmail(acc.email)
    setPassword(acc.pass)
    setError(null)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Brand Icon */}
        <div className="auth-brand-badge">
          <span>✈</span>
        </div>

        <h2 className="auth-title">Welcome to SkyResolve</h2>
        <p className="auth-subtitle">
          Sign in to access your airline resolution portal
        </p>

        {error && (
          <div className="auth-error-banner">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya.nair@example.com"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Fill Test Accounts */}
        <div className="quick-fill-section">
          <div className="quick-fill-title">Quick-fill Demo Accounts</div>
          <div className="quick-fill-chips">
            {TEST_ACCOUNTS.map((acc, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-fill-chip"
                onClick={() => fillCredentials(acc)}
                title={`Fill ${acc.email}`}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  )
}
