export function ApprovalPanel({ approval }) {
  return (
    <div className="message system">
      <div className="approval-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
        <div className="approval-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <span>Supervisor Approval Required</span>
        </div>

        <div className="approval-content" style={{ marginTop: '8px', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 8px', fontWeight: '500' }}>
            Your request requires supervisor approval. A supervisor has been notified.
          </p>

          <div style={{ fontSize: '13px', color: '#4b5563' }}>
            <strong>Reason:</strong> {approval?.reason || 'Fare difference waiver exceeds agent authority threshold.'}
            {approval?.details?.fare_difference && (
              <>
                <br />
                <strong>Fare Difference:</strong> ₹{Number(approval.details.fare_difference).toLocaleString('en-IN')}
              </>
            )}
            {approval?.details?.authority_threshold && (
              <>
                <br />
                <strong>Agent Authority Threshold:</strong> ₹{Number(approval.details.authority_threshold).toLocaleString('en-IN')}
              </>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>⏳</span>
          <span>
            <strong>Status:</strong> Supervisor approval pending
          </span>
        </div>
      </div>
    </div>
  )
}
