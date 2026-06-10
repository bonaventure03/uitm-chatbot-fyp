import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { sendChat } from '../api';
import ResponseCard from './ResponseCard';
import ThemeToggle from './ThemeToggle';

export default function ChatWindow({ suggestedQuery, onQuerySent, isDark, onToggleTheme }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your UiTM Virtual Assistant. How can I assist you today?",
      time: currentTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const lastAssistantRef = useRef(null);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && messages.length > 1) {
      lastAssistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (suggestedQuery) {
      setInput(suggestedQuery);
      onQuerySent?.();
    }
  }, [suggestedQuery]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((m) => [...m, { role: 'user', content: text, time: currentTime() }]);
    setInput('');
    setLoading(true);

    try {
      const result = await sendChat(text);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: result.answer,
          sources: result.sources,
          question: text,
          time: currentTime(),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Sorry, I couldn't reach the server. Error: ${err.message}. Make sure the backend is running on localhost:8000.`,
          time: currentTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-uitm-chat-bg dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-uitm-border dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="UiTM" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="font-display text-lg font-semibold text-uitm-maroon dark:text-uitm-gold leading-tight">
              UiTM Campus Assistant
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI-Powered One-Stop Service</p>
          </div>
        </div>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            ref={msg.role === 'assistant' && i === messages.length - 1 ? lastAssistantRef : null}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-2xl">
              {msg.role === 'user' ? (
                <div className="bg-uitm-maroon text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-[13px]">
                  {msg.content}
                </div>
              ) : (
                <ResponseCard answer={msg.content} sources={msg.sources} question={msg.question} />
              )}
              <div className={`text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-3 border border-uitm-border dark:border-gray-700 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-uitm-gold animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-uitm-gold animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-uitm-gold animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-uitm-border dark:border-gray-800 px-6 py-4">
        <div className="flex items-end gap-3 w-full">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask: How do I check exam results?"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-uitm-border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2.5 text-[13px] focus:outline-none focus:border-uitm-gold focus:ring-1 focus:ring-uitm-gold"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="flex items-center gap-2 bg-uitm-maroon hover:bg-uitm-maroon-dark disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition font-medium text-sm"
          >
            <Send size={15} />
            Send
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function currentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
