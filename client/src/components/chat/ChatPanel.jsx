import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  TrendingUp,
  PieChart,
  Receipt,
  AlertTriangle,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { SEND_CHAT_MESSAGE, CLEAR_CHAT_SESSION } from '../../graphql/mutations';
import { GET_CHAT_SESSION } from '../../graphql/queries';
import { useAuthStore } from '../../store/authStore';
import { MarkdownContent } from './MarkdownContent';

export const ChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { user } = useAuthStore();

  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('vault_chat_sid') || sessionStorage.getItem('expenseflow_chat_sid');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('vault_chat_sid', sid);
    }
    return sid;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { data, refetch } = useQuery(GET_CHAT_SESSION, {
    variables: { sessionId },
    skip: !isOpen,
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_CHAT_MESSAGE);
  const [clearSession, { loading: clearing }] = useMutation(CLEAR_CHAT_SESSION);

  const messages = data?.chatSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
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
      setShowClearConfirm(false);
      refetch();
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => {
      setCopiedIdx(null);
    }, 2000);
  };

  const quickPrompts = [
    {
      icon: Receipt,
      label: 'Monthly Expenses',
      prompt: 'What are my total expenses this month?',
      color: '#3b82f6',
    },
    {
      icon: TrendingUp,
      label: 'Net Cash Flow',
      prompt: 'What is our net operating balance?',
      color: '#10b981',
    },
    {
      icon: PieChart,
      label: 'Top Spending Categories',
      prompt: 'Which category has the highest spend?',
      color: '#8b5cf6',
    },
    {
      icon: AlertTriangle,
      label: 'Budget Overrun Alerts',
      prompt: 'Are any budget limits nearing 80%?',
      color: '#f59e0b',
    },
  ];

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className="chat-fab"
          onClick={() => setIsOpen(true)}
          title="Open Vault Financial AI Assistant"
          aria-label="Open Assistant"
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }}
            />
          </div>
        </button>
      )}

      {isOpen && (
        <div className={`chat-drawer ${isExpanded ? 'expanded' : ''}`}>
          {/* Header */}
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="chat-avatar-ai">
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                    Vault Financial AI
                  </h4>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                    <span className="chat-live-pulse" />
                    Online
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Real-time ledger analytics & financial intelligence
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {/* Expand / Minimize Toggle */}
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
                style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              {/* Clear History */}
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowClearConfirm(true)}
                title="Clear Chat History"
                style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
              >
                <Trash2 size={15} />
              </button>

              {/* Close Drawer */}
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Clear Confirmation Prompt */}
          {showClearConfirm && (
            <div className="chat-clear-banner">
              <span>Clear conversation history?</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                  onClick={handleClear}
                  disabled={clearing}
                >
                  {clearing ? 'Clearing...' : 'Yes, Clear'}
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty-state">
                <div className="chat-empty-icon-wrap">
                  <div className="chat-empty-icon">
                    <Sparkles size={24} />
                  </div>
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Ask Vault Financial Intelligence
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', maxWidth: '340px' }}>
                  Query real-time expense ledgers, revenue inflows, corporate entity disbursements, or proactive budget caps.
                </p>

                <div className="chat-quick-prompts-grid">
                  {quickPrompts.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={i}
                        className="chat-prompt-card"
                        onClick={() => handleSend(item.prompt)}
                      >
                        <div className="chat-prompt-icon" style={{ color: item.color }}>
                          <Icon size={14} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span className="chat-prompt-label">{item.label}</span>
                          <span className="chat-prompt-text">"{item.prompt}"</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
              >
                {/* Assistant Avatar */}
                {msg.role === 'assistant' && (
                  <div className="chat-msg-avatar assistant">
                    <Sparkles size={14} />
                  </div>
                )}

                <div className={`chat-bubble ${msg.role}`}>
                  {/* Bubble Header */}
                  <div className="chat-bubble-header">
                    <span className="chat-sender-name">
                      {msg.role === 'user' ? 'You' : 'Vault AI'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          className="chat-copy-btn"
                          onClick={() => handleCopy(msg.content, idx)}
                          title="Copy message to clipboard"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check size={11} style={{ color: 'var(--success)' }} />
                              <span style={{ color: 'var(--success)', fontSize: '0.65rem' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span style={{ fontSize: '0.65rem' }}>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                      {msg.createdAt && (
                        <span className="chat-time-tag">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bubble Content */}
                  <div className="chat-bubble-body">
                    {msg.role === 'assistant' ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="chat-msg-avatar user">
                    {getUserInitials(user?.name)}
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Streaming Indicator */}
            {sending && (
              <div className="chat-message-row assistant-row">
                <div className="chat-msg-avatar assistant pulse">
                  <Sparkles size={14} />
                </div>
                <div className="chat-bubble assistant thinking">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div className="chat-typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Analyzing financial ledgers & synthesizing response...
                    </span>
                  </div>
                </div>
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
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                className="input chat-input-field"
                placeholder="Ask about expenses, cash flow, top vendors, budgets..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                className="btn btn-primary chat-send-btn"
                disabled={sending || !input.trim()}
                title="Send Message (Enter)"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatPanel;
