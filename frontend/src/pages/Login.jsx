import { useState } from 'react'
import { supabase } from '../services/supabase'

export function Login({ onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
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
        // Map common Supabase Auth errors to human-friendly messages
        if (
          signInError.message?.toLowerCase().includes('invalid login credentials') ||
          signInError.message?.toLowerCase().includes('invalid credentials')
        ) {
          setError('Invalid email or password. Please verify your credentials and try again.')
        } else if (signInError.message?.toLowerCase().includes('email not confirmed')) {
          setError('Your email address has not been confirmed yet. Please check your inbox.')
        } else {
          setError(signInError.message || 'Login failed. Please try again.')
        }
        return
      }

      console.log('[Login] Sign in successful:', data?.user?.id)
      // On successful login, onAuthStateChange in AuthContext will automatically update session
    } catch (err) {
      console.error('[Login] Unexpected error during sign in:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="selection-screen">
      <div className="selection-card" style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: '#eff6ff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '24px',
              color: '#1e40af'
            }}
          >
            ✈
          </div>
          <h2>Welcome Back</h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Sign in to access your airline resolution dashboard
          </p>
        </div>

        {error && (
          <div
            className="error-message"
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '13px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="login-email"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}
            >
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1e40af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#6b7280'
          }}
        >
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e40af',
              fontWeight: '600',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}
