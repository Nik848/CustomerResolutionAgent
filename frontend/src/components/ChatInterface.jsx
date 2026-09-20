import { useRef, useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { formatTime } from '../utils/formatting'
import { ActionCard } from './ActionCard'
import { ApprovalPanel } from './ApprovalPanel'

export function ChatInterface({ customerId }) {
  const {
    messages,
    loading,
    error,
    approval,
    resuming,
    sendMessage,
    submitApproval,
    setError
  } = useChat(customerId)

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const message = inputValue.trim()
    setInputValue('')
    await sendMessage(message)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="chat-container">
      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">•</div>
            <p>
              Start a conversation to request assistance with your booking
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx}>
              {msg.type === 'approval_required' && (
                <ApprovalPanel
                  approval={msg.content}
                  resuming={resuming}
                  onSubmit={submitApproval}
                />
              )}

              {msg.type === 'approval_decision' && (
                <div className="message system">
                  <div className="message-bubble">
                    ✓ {msg.content}
                  </div>
                </div>
              )}

              {msg.type === 'error' && (
                <div className="error-message">
                  ✗ {msg.content}
                </div>
              )}

              {!msg.type && (
                <div className={`message ${msg.role}`}>
                  <div>
                    <div className="message-bubble">
                      {msg.content}

                      {/* Render multiple action results */}
                      {Array.isArray(msg.actionResult) ? (
                        msg.actionResult.map((action, actionIdx) => (
                          <ActionCard
                            key={actionIdx}
                            action={action}
                          />
                        ))
                      ) : (
                        msg.actionResult && (
                          <ActionCard action={msg.actionResult} />
                        )
                      )}
                    </div>

                    <div className="message-timestamp">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="message system">
            <div className="message-bubble">
              <span className="loading-spinner" />
              Processing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder="Describe your issue or request..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading || resuming}
            rows="1"
            style={{ minHeight: '40px' }}
          />

          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || loading || resuming}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}