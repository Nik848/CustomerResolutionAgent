import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { getStatusLabel } from '../utils/formatting'
import { ChatInterface } from '../components/ChatInterface'
import { Navbar } from '../components/Navbar'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unlinkedError, setUnlinkedError] = useState(false)
  const [activePrompt, setActivePrompt] = useState('')

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        setUnlinkedError(false)

        const customerData = await api.getMe()
        if (!active) return
        setCustomer(customerData)

        const bookingsData = await api.getBookings()
        if (!active) return
        setBookings(bookingsData.bookings || [])
        setLoading(false)
      } catch (err) {
        if (!active) return
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

  const handleQuickAsk = (booking) => {
    if (booking.status === 'cancelled') {
      setActivePrompt(`My flight ${booking.flight_number} was cancelled. Can you rebook me or provide a refund?`)
    } else if (booking.status === 'delayed') {
      setActivePrompt(`My flight ${booking.flight_number} is delayed by ${booking.delay_hours || 4} hours. What compensation or meal voucher do I qualify for?`)
    } else {
      setActivePrompt(`What is the status of my flight ${booking.flight_number}?`)
    }
  }

  // Parse travel history stats if available
  let travelHistory = {}
  if (customer?.travel_history) {
    try {
      travelHistory = typeof customer.travel_history === 'string'
        ? JSON.parse(customer.travel_history)
        : customer.travel_history
    } catch {
      travelHistory = {}
    }
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="app-container">
        <Navbar userProfile={null} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div className="status-dot" style={{ width: '12px', height: '12px', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '16px', fontWeight: '600' }}>Loading Passenger Profile...</div>
          </div>
        </div>
      </div>
    )
  }

  // Unlinked Error Screen
  if (unlinkedError) {
    return (
      <div className="app-container">
        <Navbar userProfile={{ name: user?.email }} />
        <div style={{ padding: '60px 20px', display: 'flex', justifyContent: 'center' }}>
          <div className="passenger-card" style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: '#0f172a' }}>
              No Linked Passenger Account
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
              Your account <strong>{user?.email}</strong> is authenticated, but not yet associated with an airline customer profile.
            </p>
            <button
              onClick={signOut}
              className="auth-submit-btn"
              style={{ width: 'auto', padding: '10px 24px' }}
            >
              Sign Out and Switch Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Universal Header with Logout Button */}
      <Navbar
        title="SkyResolve AI"
        subtitle="Customer Disruption Resolution Dashboard"
        userProfile={customer}
        role="customer"
      />

      <div className="dashboard-layout">
        {/* Left Sidebar: Passenger Card & Bookings */}
        <div className="sidebar-panel">
          {/* Passenger Profile */}
          <div className="passenger-card">
            <div className="passenger-header">
              <div className="passenger-avatar">
                {customer?.name?.charAt(0) || 'P'}
              </div>
              <div>
                <div className="passenger-name">{customer?.name || 'Passenger'}</div>
                <div className="passenger-id-badge">ID: {customer?.customer_id}</div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>✉️ {customer?.email || user?.email}</div>
              {customer?.phone && <div>📞 {customer?.phone}</div>}
            </div>

            {/* Travel Stats */}
            <div className="passenger-stats-grid">
              <div className="stat-box">
                <div className="stat-label">Loyalty Tier</div>
                <div className="stat-value" style={{ color: '#2563eb' }}>
                  {customer?.loyalty_tier || 'Member'}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Past 12 Mo. Flights</div>
                <div className="stat-value">
                  {travelHistory.flights_last_12_months ?? 6}
                </div>
              </div>
            </div>
          </div>

          {/* Bookings Section */}
          <div className="bookings-panel">
            <div className="panel-title-row">
              <div className="panel-title">
                <span>✈️</span>
                <span>Active Itinerary</span>
              </div>
              <span className="badge-counter">{bookings.length}</span>
            </div>

            {error ? (
              <div className="auth-error-banner">{error}</div>
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8' }}>
                <p style={{ fontSize: '14px' }}>No bookings found for this customer.</p>
              </div>
            ) : (
              <div className="bookings-list">
                {bookings.map((booking) => (
                  <div
                    key={booking.booking_id}
                    className={`booking-card ${booking.status}`}
                    onClick={() => handleQuickAsk(booking)}
                  >
                    <div className="booking-top-row">
                      <div className="flight-number-tag">
                        <span>✈</span>
                        <span>{booking.flight_number}</span>
                      </div>
                      <span className={`status-pill ${booking.status}`}>
                        {getStatusLabel(booking.status)}
                        {booking.delay_hours > 0 && ` (${booking.delay_hours}h)`}
                      </span>
                    </div>

                    <div className="booking-route-row">
                      <span className="route-city">{booking.origin}</span>
                      <span className="route-arrow">➔</span>
                      <span className="route-city">{booking.destination}</span>
                    </div>

                    <div className="booking-details-row">
                      <span>PNR: <strong style={{ color: '#0f172a' }}>{booking.pnr || 'SK4821X'}</strong></span>
                      <span>Dep: {booking.scheduled_departure || '18:40'}</span>
                    </div>

                    <button
                      type="button"
                      className="action-trigger-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickAsk(booking)
                      }}
                    >
                      💬 Ask Agent About This Flight
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Main Content: Chat Interface */}
        <ChatInterface
          customerId={customer?.customer_id}
          initialPrompt={activePrompt}
        />
      </div>
    </div>
  )
}
