import { useAuth } from '../hooks/useAuth'

export function Navbar({ title = 'SkyResolve AI', subtitle = 'Autonomous Disruption Resolution Portal', userProfile = null, role = 'customer' }) {
  const { user, signOut } = useAuth()

  const displayName = userProfile?.name || user?.email?.split('@')[0] || 'User'
  const displayEmail = userProfile?.email || user?.email || ''
  const loyaltyTier = userProfile?.loyalty_tier

  const getTierColor = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return { bg: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', text: '#0f172a', border: '#94a3b8' }
      case 'gold':
        return { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#92400e', border: '#f59e0b' }
      case 'silver':
        return { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', text: '#334155', border: '#cbd5e1' }
      default:
        return { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' }
    }
  }

  const tierStyle = loyaltyTier ? getTierColor(loyaltyTier) : null

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Left: Brand & Title */}
        <div className="navbar-brand">
          <div className="navbar-logo-badge">
            <span className="navbar-logo-icon">✈</span>
          </div>
          <div>
            <div className="navbar-title-row">
              <span className="navbar-title">{title}</span>
              <span className="navbar-status-pill">
                <span className="status-dot"></span>
                Online
              </span>
            </div>
            <p className="navbar-subtitle">{subtitle}</p>
          </div>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="navbar-user-section">
          {/* User Profile Pill */}
          <div className="user-profile-card">
            <div className="user-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="user-meta">
              <div className="user-name-row">
                <span className="user-display-name">{displayName}</span>
                {loyaltyTier && (
                  <span
                    className="loyalty-pill"
                    style={{
                      background: tierStyle.bg,
                      color: tierStyle.text,
                      borderColor: tierStyle.border
                    }}
                  >
                    ★ {loyaltyTier}
                  </span>
                )}
                {role === 'admin' && (
                  <span className="role-pill admin">
                    Supervisor
                  </span>
                )}
              </div>
              <span className="user-email">{displayEmail}</span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={signOut}
            className="navbar-logout-btn"
            title="Sign out of your account"
          >
            <svg
              className="logout-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
