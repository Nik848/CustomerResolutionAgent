import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { getTierBadgeColor, getStatusColor, getStatusLabel } from '../utils/formatting'
import { ChatInterface } from '../components/ChatInterface'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unlinkedError, setUnlinkedError] = useState(false)

  // Load customer profile and bookings from authenticated endpoints
  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        setUnlinkedError(false)

        console.log('[Dashboard] Loading profile via GET /api/me...')
        const customerData = await api.getMe()
        if (!active) return
        setCustomer(customerData)

        console.log('[Dashboard] Loading bookings via GET /api/bookings...')
        const bookingsData = await api.getBookings()
        if (!active) return
        setBookings(bookingsData.bookings || [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error('[Dashboard] Failed to load authenticated data:', err)

        if (
          err.status === 403 ||
          err.message?.toLowerCase().includes('no customer profile is linked')
        ) {
          setUnlinkedError(true)
        } else {
          setError(err.message || 'Failed to load customer profile and bookings.')
        }
        setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Airline Customer Resolution System</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '18px', fontWeight: '500' }}>
            Loading your passenger profile and bookings...
          </div>
        </div>
      </div>
    )
  }

  // Authenticated user with no linked customer in customers table
  if (unlinkedError) {
    return (
      <div className="app-container">
        <div
          className="app-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h1>Airline Customer Resolution System</h1>
          <button
            onClick={signOut}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '13px'
            }}
          >
            Sign Out
          </button>
        </div>
        <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
          <div
            className="selection-card"
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#fff',
              borderLeft: '4px solid #d97706'
            }}
          >
            <h3 style={{ fontSize: '20px', color: '#92400e', marginBottom: '12px' }}>
              Customer Profile Not Linked
            </h3>
            <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              Your account is authenticated, but no customer profile is linked to it. Please contact
              support.
            </p>

            <div
              style={{
                background: '#f9fafb',
                padding: '16px',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#374151',
                marginBottom: '24px'
              }}
            >
              <div>
                <strong>Signed In Email:</strong> {user?.email}
              </div>
              <div style={{ marginTop: '6px' }}>
                <strong>Supabase Auth UUID:</strong>{' '}
                <code style={{ fontSize: '12px', background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                  {user?.id}
                </code>
              </div>
            </div>

            <button
              onClick={signOut}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1e40af',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Sign Out and Return to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Header with App Title and Sign Out Button */}
      <div
        className="app-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h1>Airline Customer Resolution System</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>
            {customer?.name || user?.email}
          </span>
          <button
            onClick={signOut}
            title="Sign out of your account"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '13px',
              transition: 'background 0.2s'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="dashboard">
        {/* Sidebar */}
        <div className="sidebar">
          {/* Customer Context */}
          <div className="customer-context">
            <div className="customer-info">
              <h4>Customer Information</h4>
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                Welcome, {customer?.name || 'Passenger'}
              </p>
              <div className="email">{customer?.email || user?.email || 'N/A'}</div>
              {customer?.loyalty_tier && (
                <div
                  className="tier-badge"
                  style={{
                    backgroundColor: getTierBadgeColor(customer.loyalty_tier),
                    marginTop: '8px'
                  }}
                >
                  Loyalty Tier: {customer.loyalty_tier}
                </div>
              )}
            </div>
          </div>

          {/* Bookings */}
          <div className="bookings-section">
            <h4>Bookings ({bookings.length})</h4>
            {error ? (
              <div className="error-message">{error}</div>
            ) : bookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">-</div>
                <p>No bookings found</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.booking_id}
                  className={`booking-item ${booking.status}`}
                  style={{
                    borderLeftColor: getStatusColor(booking.status)
                  }}
                >
                  <div className="flight">{booking.flight_number}</div>
                  <div className="route">
                    {booking.origin} → {booking.destination}
                  </div>
                  <div
                    className="status"
                    style={{
                      backgroundColor: getStatusColor(booking.status),
                      color: 'white'
                    }}
                  >
                    {getStatusLabel(booking.status)}
                    {booking.delay_hours > 0 && ` (${booking.delay_hours}h)`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content - Chat */}
        <div className="main-content">
          <ChatInterface customerId={customer?.customer_id} />
        </div>
      </div>
    </div>
  )
}
