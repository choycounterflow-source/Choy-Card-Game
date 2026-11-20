import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

export const AskChoyBubble: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Kumusta! Ako si Ask Choy AI. Pangutana bahin sa VIP 1/VIP 2 cashback, Cash-in / Cash-out, 2km GPS lock, o table rules!',
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const deleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMessages = () => {
    setMessages([]);
  };

  const sendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ask-choy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            sender: 'ai',
            text: data.error || 'Ask Choy AI is temporarily unavailable. Please check API configuration.',
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, sender: 'ai', text: data.reply },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'Connection issue while contacting Ask Choy AI. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[320px] sm:w-[350px] overflow-hidden rounded-2xl border border-amber-400/50 bg-[#04241c] shadow-2xl">
          <div className="flex items-center justify-between bg-amber-400 px-4 py-3 text-emerald-950">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-950 text-amber-400 font-display font-bold text-sm">
                AC
              </div>
              <div>
                <h3 className="font-display text-sm font-extrabold leading-tight">Ask Choy AI</h3>
                <p className="text-[11px] font-medium text-emerald-900">Official Choy Card Game Support</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllMessages}
                  title="Delete all messages"
                  aria-label="Delete all messages"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/15 px-2 py-1 text-[10px] font-extrabold text-emerald-950 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete All
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Ask Choy AI"
                className="rounded-lg p-1 text-emerald-950/80 hover:bg-emerald-950/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={listRef} className="h-64 overflow-y-auto p-3.5 space-y-2.5 bg-[#031c16]">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-emerald-400 py-10">
                Messages cleared. Ask a question anytime!
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`group flex items-start gap-1.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'user' && (
                    <button
                      type="button"
                      onClick={() => deleteMessage(m.id)}
                      title="Delete message"
                      aria-label="Delete message"
                      className="mt-1 rounded-md p-1 text-emerald-400/70 hover:bg-red-950/70 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-amber-400 text-emerald-950 font-medium rounded-br-sm'
                        : 'bg-[#0a382c] text-emerald-50 border border-emerald-800/80 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => deleteMessage(m.id)}
                      title="Delete message"
                      aria-label="Delete message"
                      className="mt-1 rounded-md p-1 text-emerald-400/70 hover:bg-red-950/70 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[#0a382c] border border-emerald-800/80 px-3.5 py-2 text-xs text-emerald-300">
                  Ask Choy is replying...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={sendQuestion}
            className="flex items-center gap-2 border-t border-emerald-800/80 bg-[#052920] p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pangutana kay Ask Choy..."
              className="flex-1 rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2 text-xs text-white placeholder:text-emerald-400/60 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle Ask Choy AI"
        className="group flex h-14 items-center gap-2.5 rounded-full border-2 border-amber-200/80 bg-gradient-to-tr from-amber-500 to-yellow-300 px-4 text-emerald-950 shadow-2xl transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span className="font-display text-xs font-extrabold tracking-tight whitespace-nowrap">
          Ask Choy AI
        </span>
      </button>
    </div>
  );
};
