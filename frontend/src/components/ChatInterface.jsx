import { useRef, useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { formatTime } from '../utils/formatting'
import { ActionCard } from './ActionCard'
import { ApprovalPanel } from './ApprovalPanel'

const QUICK_PROMPTS = [
  'Can you rebook me?',
  'I want a refund for my cancelled flight',
  'Am I eligible for a meal voucher or lounge access?',
  'Please waive the fare difference for my new booking'
]

export function ChatInterface({ customerId, initialPrompt = '' }) {
  const {
    messages,
    loading,
    error,
    approval,
    sendMessage,
    setError
  } = useChat(customerId)

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
          <div className="agent-avatar">🤖</div>
          <div>
            <div className="agent-title">SkyResolve AI Assistant</div>
            <div className="agent-status-text">
              <span className="status-dot"></span>
              Autonomous Agent Active · LangGraph Engine
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">✈️</div>
            <h3 className="chat-empty-title">How can I resolve your disruption today?</h3>
            <p className="chat-empty-desc">
              I can instantly check policy eligibility, process full refunds, rebook flights, and issue meal vouchers or lounge access.
            </p>

            <div className="prompt-chips-container">
              {QUICK_PROMPTS.map((prompt, idx) => (
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
                    <span className="action-card-icon">✓</span>
                    <span className="action-card-title">Supervisor Resolution</span>
                  </div>
                  <p className="action-card-body">{msg.content}</p>
                </div>
              )}

              {msg.type === 'error' && (
                <div className="action-card rejected">
                  <div className="action-card-header">
                    <span className="action-card-icon">⚠</span>
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
            <span>⚠️</span> {error}
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