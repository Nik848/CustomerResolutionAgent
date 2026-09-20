import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Navbar } from '../components/Navbar'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function StatusBadge({ status }) {
  const colors = {
    pending:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    approved: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
    rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
  }
  const s = colors[status] || colors.pending
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em',
      textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.border}`
    }}>
      {status}
    </span>
  )
}

// ── Audit event type config ────────────────────────────────
const EVENT_TYPES = [
  { value: '',                           label: 'All Events' },
  { value: 'action_executed',            label: 'Action Executed' },
  { value: 'human_approval_requested',   label: 'Approval Requested' },
  { value: 'human_approval_received',    label: 'Approval Received' },
  { value: 'approval_rejected',          label: 'Approval Rejected' },
  { value: 'approval_created',           label: 'Approval Created' },
]

function eventTypeMeta(eventType) {
  switch (eventType) {
    case 'action_executed':
      return { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: '⚡', label: 'Action' }
    case 'human_approval_requested':
      return { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '⏳', label: 'Approval Request' }
    case 'human_approval_received':
      return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '✓', label: 'Approved' }
    case 'approval_rejected':
      return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: '✕', label: 'Rejected' }
    case 'approval_created':
      return { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', icon: '📋', label: 'Approval Created' }
    default:
      return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb', icon: '·', label: eventType }
  }
}

function EventTypeBadge({ eventType }) {
  const meta = eventTypeMeta(eventType)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 10px', borderRadius: '999px', fontSize: '11px',
      fontWeight: '700', letterSpacing: '0.04em', background: meta.bg,
      color: meta.color, border: `1px solid ${meta.border}`
    }}>
      {meta.icon} {meta.label}
    </span>
  )
}

// ── Approval Detail Modal ─────────────────────────────────
function ApprovalDetailModal({ approval, onClose, onApprove, onReject, processing }) {
  const [note, setNote] = useState('')
  if (!approval) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%',
        maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', padding: '32px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Supervisor Approval
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Review and action required
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Status */}
        <div style={{ marginBottom: '24px' }}>
          <StatusBadge status={approval.status} />
        </div>

        {/* Customer & Booking Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</p>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#111827' }}>{approval.customer_name || approval.customer_id}</p>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>{approval.customer_id}</p>
            {approval.customer_email && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>{approval.customer_email}</p>}
            {approval.loyalty_tier && (
              <span style={{ display: 'inline-block', marginTop: '6px', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: '#dbeafe', color: '#1e40af' }}>
                {approval.loyalty_tier} Tier
              </span>
            )}
          </div>

          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Booking</p>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#111827' }}>{approval.booking_id || '—'}</p>
            {approval.pnr && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>PNR: {approval.pnr}</p>}
            {approval.flight_number && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>Flight: {approval.flight_number}</p>}
            {approval.origin && approval.destination && (
              <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                {approval.origin} → {approval.destination}
              </p>
            )}
            {approval.travel_date && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>Date: {approval.travel_date}</p>}
            {approval.booking_status && (
              <span style={{ display: 'inline-block', marginTop: '6px', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>
                {approval.booking_status}
              </span>
            )}
          </div>
        </div>

        {/* Request Details */}
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '14px' }}>
            <span style={{ color: '#6b7280', fontWeight: '500' }}>Type:</span>
            <span style={{ color: '#111827', fontWeight: '600' }}>{approval.type || '—'}</span>

            <span style={{ color: '#6b7280', fontWeight: '500' }}>Reason:</span>
            <span style={{ color: '#111827' }}>{approval.reason || '—'}</span>

            {approval.fare_difference != null && (
              <>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Fare Difference:</span>
                <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                  ₹{Number(approval.fare_difference).toLocaleString('en-IN')}
                </span>
              </>
            )}

            {approval.details?.authority_threshold != null && (
              <>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Agent Authority:</span>
                <span style={{ color: '#374151', fontWeight: '600' }}>
                  ₹{Number(approval.details.authority_threshold).toLocaleString('en-IN')}
                </span>
              </>
            )}

            {approval.delay_hours > 0 && (
              <>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Delay:</span>
                <span style={{ color: '#374151' }}>{approval.delay_hours} hours</span>
              </>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
          <div>Created: {formatDate(approval.created_at)}</div>
          {approval.resolved_at && <div>Resolved: {formatDate(approval.resolved_at)}</div>}
          {approval.resolution_note && <div style={{ marginTop: '6px', color: '#374151' }}>Note: {approval.resolution_note}</div>}
        </div>

        {/* Decision Buttons (only for pending) */}
        {approval.status === 'pending' && (
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Resolution Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the customer or audit log..."
                rows={2}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                disabled={processing}
                onClick={() => onReject(approval.id, note)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: '2px solid #dc2626', background: '#fff',
                  color: '#dc2626', fontWeight: '700', fontSize: '15px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  opacity: processing ? 0.6 : 1, transition: 'all 0.15s'
                }}
              >
                ✕ Reject
              </button>
              <button
                disabled={processing}
                onClick={() => onApprove(approval.id, note)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: 'none', background: processing ? '#6ee7b7' : '#059669',
                  color: '#fff', fontWeight: '700', fontSize: '15px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  opacity: processing ? 0.8 : 1, transition: 'all 0.15s'
                }}
              >
                ✓ Approve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ApprovalRow({ req, onSelect }) {
  return (
    <tr
      onClick={() => onSelect(req)}
      style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: '600', color: '#111827' }}>{req.customer_name || req.customer_id}</div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>{req.customer_id}</div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: '500', color: '#374151' }}>{req.type || '—'}</div>
        {req.fare_difference != null && (
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>
            ₹{Number(req.fare_difference).toLocaleString('en-IN')}
          </div>
        )}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ color: '#374151' }}>{req.booking_id || '—'}</div>
        {req.flight_number && <div style={{ fontSize: '12px', color: '#6b7280' }}>{req.flight_number}</div>}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>
        {formatDate(req.created_at)}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <StatusBadge status={req.status} />
      </td>
    </tr>
  )
}

// ── Audit Log Row ─────────────────────────────────────────
function AuditRow({ event, expanded, onToggle }) {
  const meta = eventTypeMeta(event.event_type)
  const detailStr = JSON.stringify(event.details, null, 2)

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderBottom: expanded ? 'none' : '1px solid #f3f4f6',
          background: expanded ? '#fafbff' : 'transparent'
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = '#f9fafb' }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
          {formatDate(event.timestamp)}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <EventTypeBadge eventType={event.event_type} />
        </td>
        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>
          {event.customer_id || '—'}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>
          {event.booking_id || '—'}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
          {/* Show first key of details as a quick summary */}
          {event.details && Object.keys(event.details).length > 0
            ? Object.keys(event.details).slice(0, 2).join(', ')
            : '—'}
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
          <td colSpan={6} style={{ padding: '0 16px 16px 16px' }}>
            <pre style={{
              margin: 0, padding: '12px 16px', borderRadius: '6px',
              background: '#1e293b', color: '#e2e8f0', fontSize: '12px',
              lineHeight: '1.6', overflowX: 'auto', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
            }}>
              {detailStr}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Logs Panel ────────────────────────────────────────────
function LogsPanel() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filterEventType, setFilterEventType] = useState('')
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [customerInput, setCustomerInput] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getAuditLogs({
        eventType: filterEventType || undefined,
        customerId: filterCustomerId || undefined,
        limit: 200
      })
      setEvents(res.events || [])
    } catch (err) {
      setError(err.message || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [filterEventType, filterCustomerId])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleCustomerFilter = () => {
    setFilterCustomerId(customerInput.trim())
  }

  const handleClearFilters = () => {
    setFilterEventType('')
    setFilterCustomerId('')
    setCustomerInput('')
  }

  // Count per event type for summary chips
  const typeCounts = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Filter Bar */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
        padding: '16px 20px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
      }}>
        <select
          id="log-event-type-filter"
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
            fontSize: '13px', color: '#374151', background: '#fff', cursor: 'pointer'
          }}
        >
          {EVENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            id="log-customer-filter"
            type="text"
            placeholder="Filter by customer ID..."
            value={customerInput}
            onChange={(e) => setCustomerInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomerFilter()}
            style={{
              padding: '7px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
              fontSize: '13px', color: '#374151', width: '200px'
            }}
          />
          <button
            onClick={handleCustomerFilter}
            style={{
              padding: '7px 14px', borderRadius: '6px', border: 'none',
              background: '#1e40af', color: '#fff', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            Filter
          </button>
        </div>

        {(filterEventType || filterCustomerId) && (
          <button
            onClick={handleClearFilters}
            style={{
              padding: '7px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
              background: '#f9fafb', color: '#6b7280', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            ✕ Clear
          </button>
        )}

        <button
          onClick={loadLogs}
          style={{
            marginLeft: 'auto', padding: '7px 16px', background: '#f3f4f6',
            border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', color: '#374151',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 21h5v-5"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary Chips */}
      {Object.keys(typeCounts).length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {Object.entries(typeCounts).map(([type, count]) => {
            const meta = eventTypeMeta(type)
            return (
              <button
                key={type}
                onClick={() => setFilterEventType(filterEventType === type ? '' : type)}
                style={{
                  padding: '4px 12px', borderRadius: '999px', border: `1px solid ${meta.border}`,
                  background: filterEventType === type ? meta.color : meta.bg,
                  color: filterEventType === type ? '#fff' : meta.color,
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {meta.icon} {meta.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Loading audit logs…</div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
            ⚠ {error}
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ marginBottom: '12px', fontSize: '32px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#64748b' }}>No audit events found</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>
              {filterEventType || filterCustomerId ? 'Try clearing the filters.' : 'Events will appear here as the agent processes requests.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Timestamp', 'Event Type', 'Customer', 'Booking', 'Summary', ''].map(col => (
                  <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <AuditRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {events.length > 0 && (
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
          Showing {events.length} events · Click any row to expand details
        </p>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────
export function AdminDashboard() {
  const { user, signOut } = useAuth()
  const [adminProfile, setAdminProfile] = useState(null)
  const [pending, setPending] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [meRes, approvalsRes] = await Promise.all([
        api.getMe(),
        api.getAdminApprovals()
      ])
      setAdminProfile(meRes)
      setPending(approvalsRes.pending || [])
      setHistory(approvalsRes.history || [])
    } catch (err) {
      setError(err.message || 'Failed to load admin dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleApprove = async (approvalId, note) => {
    setProcessing(true)
    try {
      await api.approveRequest(approvalId, note)
      setSelectedApproval(null)
      showToast('Request approved successfully. LangGraph workflow resumed.', 'success')
      await loadData()
    } catch (err) {
      showToast(err.message || 'Failed to approve request.', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (approvalId, note) => {
    setProcessing(true)
    try {
      await api.rejectRequest(approvalId, note)
      setSelectedApproval(null)
      showToast('Request rejected. LangGraph workflow resumed.', 'success')
      await loadData()
    } catch (err) {
      showToast(err.message || 'Failed to reject request.', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleSelectRow = async (req) => {
    try {
      const detail = await api.getAdminApprovalDetails(req.id)
      setSelectedApproval(detail)
    } catch (err) {
      showToast(err.message || 'Failed to load approval details.', 'error')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div className="status-dot" style={{ width: '12px', height: '12px', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '15px', fontWeight: '500' }}>Loading Supervisor Dashboard...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '24px', maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', color: '#dc2626' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>Access Error</div>
          <div style={{ color: '#b91c1c', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
          <button onClick={signOut} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'pending', label: `Pending (${pending.length})` },
    { id: 'history', label: `History (${history.length})` },
    { id: 'logs',    label: '📋 Audit Logs' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Navigation */}
      <Navbar
        title="SkyResolve Supervisor"
        subtitle="Human-in-the-Loop Disruption Approval Center"
        userProfile={adminProfile}
        role="admin"
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 100,
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#fff', padding: '12px 20px', borderRadius: '8px',
          fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'slideIn 0.2s ease'
        }}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Stats Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b' }}>{pending.length}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Pending</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>
              {history.filter(h => h.status === 'approved').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Approved</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>
              {history.filter(h => h.status === 'rejected').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Rejected</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <button
              onClick={loadData}
              style={{
                padding: '7px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                color: '#374151', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color: activeTab === tab.id ? '#1e40af' : '#6b7280',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Logs Tab */}
        {activeTab === 'logs' && <LogsPanel />}

        {/* Approvals Table (pending / history) */}
        {activeTab !== 'logs' && (
          <>
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {(activeTab === 'pending' ? pending : history).length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ marginBottom: '12px', color: '#cbd5e1' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '500', color: '#64748b' }}>
                    {activeTab === 'pending' ? 'No pending approvals' : 'No resolved requests yet'}
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Customer', 'Request Type', 'Booking', 'Created', 'Status'].map(col => (
                        <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'pending' ? pending : history).map(req => (
                      <ApprovalRow key={req.id} req={req} onSelect={handleSelectRow} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {pending.length > 0 && activeTab === 'pending' && (
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                Click any row to view full details and take action.
              </p>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          processing={processing}
        />
      )}
    </div>
  )
}
