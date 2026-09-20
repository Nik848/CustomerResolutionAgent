import { useState, useCallback, useEffect } from 'react'
import { api } from '../services/api'

const THREAD_ID_STORAGE_KEY = 'airline_resolution_thread_'

export const useChat = (customerId, { onApprovalResolved, onActionCompleted } = {}) => {
  const [messages, setMessages] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [approval, setApproval] = useState(null) // holds the interrupt payload
  const [approvalResolved, setApprovalResolved] = useState(false)

  // Store thread ID per customer so conversations persist and don't bleed into each other
  useEffect(() => {
    const keySuffix = customerId || 'session'
    const storageKey = THREAD_ID_STORAGE_KEY + keySuffix
    let tid = localStorage.getItem(storageKey)

    if (!tid) {
      tid = `session-${Date.now()}`
      localStorage.setItem(storageKey, tid)
    }

    setThreadId(tid)
  }, [customerId])

  const sendMessage = useCallback(
    async (userMessage) => {
      if (!userMessage.trim() || !threadId) {
        setError('Missing message or active session')
        return
      }

      // Show the user's message right away so the UI feels instant
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: userMessage, timestamp: new Date() }
      ])

      setLoading(true)
      setError(null)
      setApproval(null)

      try {
        // Identity is determined automatically by Supabase Auth Bearer token
        const result = await api.chat(userMessage, threadId)

        // Backend returned a paused graph — show the approval panel and agent explanation
        if (result.status === 'human_approval_required') {
          const interruptData = result.interrupt || {
            reason: 'Fare difference waiver exceeds agent authority threshold.',
            details: result.decision || {}
          }
          setApproval({ ...interruptData, thread_id: result.thread_id || threadId })
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              type: 'approval_required',
              content: interruptData,
              timestamp: new Date()
            },
            ...(result.response ? [{
              role: 'agent',
              content: result.response,
              decision: result.decision,
              timestamp: new Date()
            }] : [])
          ])
        } else if (result.status === 'completed') {
          if (result.response) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'agent',
                content: result.response,
                decision: result.decision,
                actionResult: result.action_result,
                timestamp: new Date()
              }
            ])
          }

          // Trigger immediate itinerary / state refresh
          if (typeof onActionCompleted === 'function') {
            try {
              onActionCompleted(result)
            } catch {
              // Ignore refresh errors
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to process message')
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            type: 'error',
            content: err.message,
            timestamp: new Date()
          }
        ])
      } finally {
        setLoading(false)
      }
    },
    [threadId]
  )

  // Poll for approval status when a human approval is pending
  useEffect(() => {
    if (!approval || !threadId) return

    const interval = setInterval(async () => {
      try {
        const res = await api.getApprovalStatus(threadId)
        if (res && (res.status === 'approved' || res.status === 'rejected')) {
          clearInterval(interval)
          setApproval(null)
          setApprovalResolved(true)

          const isApproved = res.status === 'approved'
          const decisionText = isApproved
            ? 'Approval verified: Supervisor approved the fare difference waiver.'
            : 'Approval notice: Supervisor did not approve the waiver.'

          setMessages((prev) => {
            if (prev.some(m => m.type === 'approval_decision')) return prev

            const updated = prev.map(m => {
              if (m.type === 'approval_required') {
                return {
                  ...m,
                  content: {
                    ...(m.content || {}),
                    status: res.status,
                    isApproved
                  }
                }
              }
              return m
            })

            return [
              ...updated,
              {
                role: 'system',
                type: 'approval_decision',
                content: decisionText,
                timestamp: new Date()
              },
              {
                role: 'agent',
                content: res.response,
                timestamp: new Date()
              }
            ]
          })

          // Notify parent to refresh itinerary
          if (typeof onApprovalResolved === 'function') {
            onApprovalResolved({ status: res.status, bookingId: res.booking_id })
          }
          if (typeof onActionCompleted === 'function') {
            try {
              onActionCompleted(res)
            } catch {
              // Ignore refresh errors
            }
          }
        }
      } catch (err) {
        // Ignore background polling errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [approval, threadId, onApprovalResolved, onActionCompleted])

  return {
    messages,
    threadId,
    loading,
    error,
    approval,
    approvalResolved,
    sendMessage,
    setError
  }
}
