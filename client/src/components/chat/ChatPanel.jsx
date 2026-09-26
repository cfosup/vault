import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { MessageSquare, X, Send, Trash2, HelpCircle } from 'lucide-react';
import { SEND_CHAT_MESSAGE, CLEAR_CHAT_SESSION } from '../../graphql/mutations';
import { GET_CHAT_SESSION } from '../../graphql/queries';

export const ChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('vault_chat_sid') || sessionStorage.getItem('expenseflow_chat_sid');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('vault_chat_sid', sid);
    }
    return sid;
  });

  const messagesEndRef = useRef(null);

  const { data, refetch } = useQuery(GET_CHAT_SESSION, {
    variables: { sessionId },
    skip: !isOpen,
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_CHAT_MESSAGE);
  const [clearSession] = useMutation(CLEAR_CHAT_SESSION);

  const messages = data?.chatSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, sending]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || sending) return;

    setInput('');
    try {
      await sendMessage({
        variables: {
          sessionId,
          message: text.trim(),
        },
      });
      refetch();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleClear = async () => {
    try {
      await clearSession({ variables: { sessionId } });
      refetch();
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  };

  const quickPrompts = [
    'What are my total expenses this month?',
    'What is our net operating balance?',
    'Which category has the highest spend?',
    'Are any budget limits nearing 80%?',
  ];

  return (
    <>
      {!isOpen && (
        <button
          className="chat-fab"
          onClick={() => setIsOpen(true)}
          title="Open Finance Assistant"
          aria-label="Open Assistant"
        >
          <MessageSquare size={20} />
        </button>
      )}

      {isOpen && (
        <div className="chat-drawer">
          {/* Header */}
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <MessageSquare size={15} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Vault AI Assistant</h4>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Workspace Queries</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={handleClear}
                title="Clear Chat History"
                style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
              >
                <Trash2 size={14} />
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsOpen(false)}
                title="Close Drawer"
                style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: 'var(--text-muted)' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    color: 'var(--primary)',
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  How can I help you today?
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Ask questions about expenses, cash flow trends, budget caps, or legal entity totals.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        padding: '0.45rem 0.75rem',
                        lineHeight: 1.3,
                      }}
                      onClick={() => handleSend(prompt)}
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}

            {sending && (
              <div
                className="chat-msg assistant"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                }}
              >
                <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                <span>Loading financial report...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              className="input"
              style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              placeholder="Ask anything about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={sending || !input.trim()}
              style={{ padding: '0.5rem 0.75rem', flexShrink: 0 }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatPanel;
