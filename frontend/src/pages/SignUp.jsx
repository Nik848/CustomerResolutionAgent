import { useState } from 'react'
import { supabase } from '../services/supabase'

export function SignUp({ onSwitchToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const validateEmail = (val) => {
    return /\S+@\S+\.\S+/.test(val)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    // 1. All fields required
    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }

    // 2. Valid email format
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    // 3. Password minimum 6 characters
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    // 4. Password and confirm password must match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: trimmedName
          }
        }
      })

      if (signUpError) {
        if (
          signUpError.message?.toLowerCase().includes('already registered') ||
          signUpError.message?.toLowerCase().includes('user already exists')
        ) {
          setError('An account with this email address already exists. Please sign in.')
        } else if (signUpError.message?.toLowerCase().includes('password')) {
          setError(signUpError.message)
        } else {
          setError(signUpError.message || 'Registration failed. Please try again.')
        }
        return
      }

      console.log('[SignUp] Sign up successful:', data?.user?.id)

      if (data?.user && !data?.session) {
        setSuccessMessage(
          'Registration successful! If email confirmation is enabled on your project, please check your inbox to activate your account.'
        )
      }
    } catch (err) {
      console.error('[SignUp] Unexpected error during sign up:', err)
      setError('An unexpected error occurred during sign up. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand-badge">
          <span>✈</span>
        </div>

        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">
          Register to access your airline customer resolution portal
        </p>

        {error && (
          <div className="auth-error-banner">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div
            style={{
              padding: '24px',
              backgroundColor: '#ecfdf5',
              borderRadius: '12px',
              border: '1px solid #a7f3d0',
              textAlign: 'center',
              marginBottom: '24px'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
            <h3 style={{ color: '#065f46', fontSize: '18px', marginBottom: '8px' }}>
              Registration Successful!
            </h3>
            <p style={{ color: '#047857', fontSize: '14px', lineHeight: 1.6 }}>
              {successMessage}
            </p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="auth-submit-btn"
              style={{ marginTop: '16px' }}
            >
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Nair"
                disabled={loading}
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">
                Password (min. 6 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#64748b'
          }}
        >
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: '600',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}
