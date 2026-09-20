import { useState, useEffect } from 'react'
import { api } from './services/api'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { Dashboard } from './pages/Dashboard'
import { AdminDashboard } from './pages/AdminDashboard'

function AppContent() {
  const { session, user, loading: authLoading } = useAuth()
  const [authView, setAuthView] = useState('login') // 'login' | 'signup'
  const [backendAvailable, setBackendAvailable] = useState(null)
  const [backendError, setBackendError] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)

  // Reset role when session changes (e.g. sign out or new sign in)
  useEffect(() => {
    if (!session) {
      setUserRole(null)
      setRoleLoading(false)
    }
  }, [session])

  // Check backend health on mount
  useEffect(() => {
    console.log(`[App] Checking backend health at: ${import.meta.env.VITE_API_URL}`)
    api
      .health()
      .then((res) => {
        console.log('[App] Backend health check passed:', res)
        setBackendAvailable(true)
        setBackendError(null)
      })
      .catch((err) => {
        console.error('[App] Backend health check failed:', err)
        setBackendAvailable(false)
        setBackendError(err.message)
      })
  }, [])

  // 1. Initial backend connection check
  if (backendAvailable === null) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Airline Customer Resolution System</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>
            Checking backend connection...
          </div>
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
            Expected URL: {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
          </div>
        </div>
      </div>
    )
  }

  // 2. Backend unavailable screen
  if (!backendAvailable) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Airline Customer Resolution System</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <strong>Backend Unavailable</strong>
            <p style={{ marginTop: '8px', textAlign: 'left' }}>
              Unable to connect to the resolution service.
              <br /><br />
              <strong>Expected URL:</strong> {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
              <br />
              <strong>Error:</strong> {backendError}
              <br /><br />
              <strong>Steps to fix:</strong>
              <br />
              1. Open a terminal and run:
              <br />
              <code style={{ backgroundColor: '#f3f4f6', padding: '8px', display: 'inline-block', marginTop: '4px' }}>
                cd ai-service<br />
                ./venv/Scripts/python -m uvicorn app.main:app --reload
              </code>
              <br /><br />
              2. Wait for "Application startup complete"
              <br />
              3. Refresh this page
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Initial Supabase session check
  if (authLoading) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Airline Customer Resolution System</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '18px' }}>Verifying session...</div>
        </div>
      </div>
    )
  }

  // 4. Authenticated — determine role then show correct dashboard
  if (session && user) {
    // If role not loaded yet, fetch it
    if (userRole === null && !roleLoading) {
      setRoleLoading(true)
      api.getMe()
        .then((data) => {
          setUserRole(data.role || 'customer')
        })
        .catch(() => {
          setUserRole('customer')
        })
        .finally(() => setRoleLoading(false))
    }

    if (roleLoading || userRole === null) {
      return (
        <div className="app-container">
          <div className="app-header">
            <h1>Airline Customer Resolution System</h1>
          </div>
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '18px' }}>Loading profile...</div>
          </div>
        </div>
      )
    }

    if (userRole === 'admin') {
      return <AdminDashboard />
    }

    return <Dashboard />
  }

  // 5. Unauthenticated -> Show Login or Sign Up
  if (authView === 'signup') {
    return <SignUp onSwitchToLogin={() => setAuthView('login')} />
  }

  return <Login onSwitchToSignUp={() => setAuthView('signup')} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
