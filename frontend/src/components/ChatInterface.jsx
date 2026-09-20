import { useRef, useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { formatTime } from '../utils/formatting'
import { ActionCard } from './ActionCard'
import { ApprovalPanel } from './ApprovalPanel'

function getContextualPrompts(bookings = []) {
  const prompts = []
  const hasCancelled = bookings.some(b => b.status === 'cancelled')
  const hasDelayed = bookings.some(b => b.status === 'delayed')
  const hasFareDiff = bookings.some(b => b.fare_difference && Number(b.fare_difference) > 0)
  const isRebooked = bookings.some(b => b.rebooking_status === 'confirmed')
  const hasLongDelay = bookings.some(b => b.status === 'delayed' && (b.delay_hours || 0) > 5)

  if (hasCancelled) {
    if (isRebooked) {
      prompts.push('Check the details of my rebooked flight')
    } else {
      prompts.push('Can you rebook my cancelled flight?')
      prompts.push('I want a refund for my cancelled flight')
    }
  }

  if (hasDelayed) {
    prompts.push('Am I eligible for a meal voucher or lounge access?')
    if (hasLongDelay) {
      prompts.push('Can you arrange hotel accommodations for my delayed flight?')
    }
  }

  if (hasFareDiff) {
    prompts.push('Please waive the fare difference for my booking')
  }

  if (prompts.length === 0) {
    prompts.push('What is the status of my flight?')
    prompts.push('What is your disruption compensation policy?')
    prompts.push('Am I eligible for lounge access or meal vouchers?')
  }

  return prompts.slice(0, 4)
}

export function ChatInterface({ customerId, bookings = [], initialPrompt = '', onApprovalResolved, onActionCompleted }) {
  const quickPrompts = getContextualPrompts(bookings)
  const {
    messages,
    loading,
    error,
    approval,
    sendMessage,
    setError
  } = useChat(customerId, { onApprovalResolved, onActionCompleted })

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Sync initialPrompt if provided
  useEffect(() => {
    if (initialPrompt) {
      setInputValue(initialPrompt)
      textareaRef.current?.focus()
    }
  }, [initialPrompt])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputValue).trim()
    if (!text || loading) return

    setInputValue('')
    await sendMessage(text)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="chat-panel">
      {/* Top Header */}
      <div className="chat-panel-header">
        <div className="agent-identity">
          <div className="agent-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
              <rect x="4" y="8" width="16" height="12" rx="2"/>
              <path d="M2 14h2"/>
              <path d="M20 14h2"/>
              <path d="M9 13v2"/>
              <path d="M15 13v2"/>
            </svg>
          </div>
          <div>
            <div className="agent-title">SkyResolve Resolution Agent</div>
            <div className="agent-status-text">
              <span className="status-dot"></span>
              Autonomous Agent Active · LangGraph Policy Engine
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
              </svg>
            </div>
            <h3 className="chat-empty-title">Customer Resolution Assistant</h3>
            <p className="chat-empty-desc">
              Check policy entitlement, submit disruption requests, process refunds, rebook flights, or request supervisor approval.
            </p>

            <div className="prompt-chips-container">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  className="prompt-chip"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="message-container">
              {msg.type === 'approval_required' && (
                <ApprovalPanel
                  approval={msg.content}
                />
              )}

              {msg.type === 'approval_decision' && (
                <div className="action-card success">
                  <div className="action-card-header">
                    <span className="action-card-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <span className="action-card-title">Approval Verified</span>
                  </div>
                  <p className="action-card-body">{msg.content}</p>
                </div>
              )}

              {msg.type === 'error' && (
                <div className="action-card rejected">
                  <div className="action-card-header">
                    <span className="action-card-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </span>
                    <span className="action-card-title">Resolution Notice</span>
                  </div>
                  <p className="action-card-body">{msg.content}</p>
                </div>
              )}

              {!msg.type && (
                <div className={`message-row ${msg.role}`}>
                  <div className="message-content-wrapper">
                    <div className="message-bubble">
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                      {/* Render structured action cards if actions were performed */}
                      {Array.isArray(msg.actionResult) ? (
                        msg.actionResult.map((action, aIdx) => (
                          <ActionCard key={aIdx} action={action} />
                        ))
                      ) : (
                        msg.actionResult && <ActionCard action={msg.actionResult} />
                      )}
                    </div>
                    <span className="message-timestamp">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading typing indicator */}
        {loading && (
          <div className="message-row agent">
            <div className="message-content-wrapper">
              <div className="typing-bubble">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                  Evaluating policies & processing...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {error && (
          <div className="auth-error-banner" style={{ marginBottom: '12px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Type your question or request (e.g. Can you rebook my flight?)..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
            rows={1}
          />

          <button
            className="chat-send-btn"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || loading}
            title="Send message"
          >
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}