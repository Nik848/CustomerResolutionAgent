/**
 * Formatting utilities
 */

export const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

export const formatTime = (dateString) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

export const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return ''
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export const formatDelay = (hours) => {
  if (!hours) return ''
  return `${hours}h delay`
}

export const getTierBadgeColor = (tier) => {
  const colors = {
    Gold: '#fbbf24',
    Silver: '#d1d5db',
    Platinum: '#e9d5ff'
  }
  return colors[tier] || '#e5e7eb'
}

export const getStatusColor = (status) => {
  const colors = {
    cancelled: '#dc2626',
    delayed: '#f59e0b',
    unaffected: '#10b981'
  }
  return colors[status] || '#6b7280'
}

export const getStatusLabel = (status) => {
  const labels = {
    cancelled: 'Cancelled',
    delayed: 'Delayed',
    unaffected: 'Unaffected'
  }
  return labels[status] || status
}
