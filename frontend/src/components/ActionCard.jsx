import { ACTION_ICONS } from '../utils/constants'

export function ActionCard({ action }) {
  if (!action || !action.success) {
    return null
  }

  const actionId = action.action
  const meta = ACTION_ICONS[actionId]

  return (
    <div className="action-result">
      <div className="action-header">
        <span className="action-icon">{meta?.icon || '•'}</span>
        <div>
          <div className="action-title">{meta?.label || 'Action Completed'}</div>
          <div className="action-status">{action.message}</div>
        </div>
      </div>

      {action.booking_id && (
        <div className="action-details">
          <strong>Booking ID:</strong> {action.booking_id}
          {action.customer_id && <><br /><strong>Customer ID:</strong> {action.customer_id}</>}
        </div>
      )}
    </div>
  )
}
