import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { askAi } from '../services/ai';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function AiAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Hello! I\'m your ERP assistant. Ask me anything about your projects, tasks, WIRs, finances, or any other module.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await askAi(q);
      setMessages(prev => [...prev, { role: 'assistant', text: res.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : 'Request failed'}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-end sm:justify-end p-0 sm:p-4 pointer-events-none">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full sm:w-96 h-[70vh] sm:h-[500px] rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col pointer-events-auto"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="font-semibold text-sm">AI Assistant</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--color-text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="shrink-0 mt-1">
                  <Bot size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-sm'
                    : 'rounded-bl-sm'
                }`}
                style={{
                  backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface-hover, rgba(255,255,255,0.05))',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                }}
              >
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="shrink-0 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <User size={18} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <Bot size={18} style={{ color: 'var(--color-primary)' }} />
              <div className="rounded-xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2" style={{ backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.05))' }}>
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="btn-primary btn-sm"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
