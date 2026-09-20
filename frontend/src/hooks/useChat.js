import { useState, useCallback, useEffect } from 'react'
import { api } from '../services/api'

const THREAD_ID_STORAGE_KEY = 'airline_resolution_thread_'

export const useChat = (customerId) => {
  const [messages, setMessages] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [approval, setApproval] = useState(null) // holds the interrupt payload
  const [resuming, setResuming] = useState(false)

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

        // Backend returned a paused graph — show the approval panel
        if (result.status === 'human_approval_required' && result.interrupt) {
          setApproval({ ...result.interrupt, thread_id: result.thread_id || threadId })
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              type: 'approval_required',
              content: result.interrupt,
              timestamp: new Date()
            }
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

  const submitApproval = useCallback(
    async (approved) => {
      if (!threadId) {
        setError('No active session')
        return
      }

      setResuming(true)
      setError(null)

      try {
        // Send "approve" or "reject" — matches the ResumeRequest schema on the backend
        const result = await api.resume(threadId, approved ? 'approve' : 'reject')

        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            type: 'approval_decision',
            content: approved ? 'Waiver approved by supervisor' : 'Waiver rejected by supervisor',
            timestamp: new Date()
          }
        ])

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

        setApproval(null)
      } catch (err) {
        setError(err.message || 'Failed to submit approval')
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
        setResuming(false)
      }
    },
    [threadId]
  )

  return {
    messages,
    threadId,
    loading,
    error,
    approval,
    resuming,
    sendMessage,
    submitApproval,
    setError
  }
}
