/**
 * Test customers for selection screen
 */
export const TEST_CUSTOMERS = [
  {
    id: 'CUST001',
    name: 'Priya Nair',
    tier: 'Gold',
    email: 'priya.nair@example.com',
    avatar: 'PN'
  },
  {
    id: 'CUST002',
    name: 'Arvind Kulkarni',
    tier: 'Silver',
    email: 'arvind.kulkarni@example.com',
    avatar: 'AK'
  },
  {
    id: 'CUST003',
    name: 'Meher Kaur',
    tier: 'Platinum',
    email: 'meher.kaur@example.com',
    avatar: 'MK'
  }
]

/**
 * Action icons and metadata
 */
export const ACTION_ICONS = {
  initiate_refund: { icon: '↓', label: 'Refund Issued' },
  rebook_flight: { icon: '→', label: 'Flight Rebooked' },
  issue_meal_voucher: { icon: '◆', label: 'Meal Voucher Issued' },
  grant_lounge_access: { icon: '⬜', label: 'Lounge Access Granted' },
  arrange_hotel: { icon: '▪', label: 'Hotel Arranged' },
  human_approval: { icon: '⊙', label: 'Pending Approval' }
}

/**
 * Status labels and colors
 */
export const STATUS_STYLES = {
  cancelled: { color: '#dc2626', label: 'Cancelled' },
  delayed: { color: '#f59e0b', label: 'Delayed' },
  unaffected: { color: '#10b981', label: 'Unaffected' }
}

export const TIER_COLORS = {
  Gold: '#fbbf24',
  Silver: '#d1d5db',
  Platinum: '#e9d5ff'
}
