export function ApprovalPanel({ approval }) {
  const isApproved = approval?.status === 'approved' || approval?.isApproved === true;
  const isRejected = approval?.status === 'rejected';

  const borderColor = isApproved ? '#10b981' : isRejected ? '#ef4444' : '#f59e0b';
  const badgeBg = isApproved ? '#d1fae5' : isRejected ? '#fee2e2' : '#fef3c7';
  const badgeBorder = isApproved ? '#a7f3d0' : isRejected ? '#fca5a5' : '#fde68a';
  const badgeColor = isApproved ? '#065f46' : isRejected ? '#991b1b' : '#92400e';
  const statusTitle = isApproved ? 'Approval Verified' : isRejected ? 'Supervisor Request Rejected' : 'Supervisor Approval Required';

  return (
    <div className="message system">
      <div className="approval-panel" style={{ borderLeft: `4px solid ${borderColor}` }}>
        <div className="approval-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isApproved ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          )}
          <span>{statusTitle}</span>
        </div>

        <div className="approval-content" style={{ marginTop: '8px', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 8px', fontWeight: '500' }}>
            {isApproved
              ? 'Supervisor has approved this request. The workflow has resumed.'
              : isRejected
              ? 'Supervisor rejected this waiver request.'
              : 'Your request requires supervisor approval. A supervisor has been notified.'}
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
            backgroundColor: badgeBg,
            border: `1px solid ${badgeBorder}`,
            borderRadius: '4px',
            fontSize: '13px',
            color: badgeColor,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isApproved ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
          <span>
            <strong>Status:</strong> {isApproved ? 'Approval Verified — Request Approved' : isRejected ? 'Rejected by Supervisor' : 'Supervisor approval pending'}
          </span>
        </div>
      </div>
    </div>
  )
}
