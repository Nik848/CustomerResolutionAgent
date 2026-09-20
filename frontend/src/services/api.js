import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

const getAuthHeaders = async () => {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json'
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return headers
}

const handleApiResponse = async (res) => {
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`
    try {
      const errData = await res.json()
      if (errData?.detail) {
        errorDetail = errData.detail
      }
    } catch {
      // ignore json parse error on non-json error responses
    }
    const err = new Error(errorDetail)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  // Returns authenticated customer info (GET /api/me)
  getMe: async () => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${API_URL}/api/me`, {
      method: 'GET',
      headers
    })
    return handleApiResponse(res)
  },

  // Returns bookings for the authenticated customer
  getBookings: async () => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${API_URL}/api/bookings`, {
      method: 'GET',
      headers
    })
    return handleApiResponse(res)
  },

  // Sends chat message with identity derived from authenticated session
  chat: async (message, threadId) => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${API_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, thread_id: threadId })
    })
    return handleApiResponse(res)
  },

  // Resumes paused LangGraph workflow with supervisor decision
  resume: async (threadId, decision) => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(
      `${API_URL}/api/resume?thread_id=${encodeURIComponent(threadId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision })
      }
    )
    return handleApiResponse(res)
  },

  // ─── Admin Endpoints ──────────────────────────────────────────
  getAdminApprovals: async () => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${API_URL}/api/admin/approvals`, {
      method: 'GET',
      headers
    })
    return handleApiResponse(res)
  },

  getAdminApprovalDetails: async (approvalId) => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${API_URL}/api/admin/approvals/${encodeURIComponent(approvalId)}`, {
      method: 'GET',
      headers
    })
    return handleApiResponse(res)
  },

  approveRequest: async (approvalId, resolutionNote) => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(
      `${API_URL}/api/admin/approvals/${encodeURIComponent(approvalId)}/approve`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolution_note: resolutionNote })
      }
    )
    return handleApiResponse(res)
  },

  rejectRequest: async (approvalId, resolutionNote) => {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(
      `${API_URL}/api/admin/approvals/${encodeURIComponent(approvalId)}/reject`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolution_note: resolutionNote })
      }
    )
    return handleApiResponse(res)
  },

  // Health check endpoint (unauthenticated)
  health: async () => {
    const res = await fetchWithTimeout(`${API_URL}/api/health`)
    return handleApiResponse(res)
  }
}
