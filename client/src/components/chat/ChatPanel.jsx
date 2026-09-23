import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { MessageSquare, X, Send, Trash2, Bot, Sparkles } from 'lucide-react';
import { SEND_CHAT_MESSAGE, CLEAR_CHAT_SESSION } from '../../graphql/mutations';
import { GET_CHAT_SESSION } from '../../graphql/queries';

export const ChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('expenseflow_chat_sid');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('expenseflow_chat_sid', sid);
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
  }, [messages, isOpen]);

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
    'What are my total expenses?',
    'What is our net balance?',
    'Top spending category?',
    'How are our budgets doing?',
  ];

  return (
    <>
      {!isOpen && (
        <button
          className="chat-fab"
          onClick={() => setIsOpen(true)}
          title="Ask AI Assistant"
        >
          <Sparkles size={24} />
        </button>
      )}

      {isOpen && (
        <div className="chat-drawer">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Financial AI Assistant</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClear}
                title="Clear Chat History"
                style={{ padding: '0.3rem' }}
              >
                <Trash2 size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{ padding: '0.3rem' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)' }}>
                <Bot size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Ask any question about your company expenses, income, net balance, or category limits!
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', textAlign: 'left', justifyContent: 'flex-start' }}
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
              <div className="chat-msg assistant" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                Analyzing financial data...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
              style={{ fontSize: '0.825rem', padding: '0.4rem 0.65rem' }}
              placeholder="Ask anything about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={sending || !input.trim()}
              style={{ padding: '0.4rem 0.75rem' }}
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
