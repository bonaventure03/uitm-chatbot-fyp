import { useState } from 'react';
import { ExternalLink, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import { submitFeedback } from '../api';

function renderBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith('**') && seg.endsWith('**')
      ? <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>
      : <span key={i}>{seg}</span>
  );
}

export default function ResponseCard({ answer, sources, question }) {
  // null = not rated, 'up' / 'down' = rated. Only shown when a question exists
  // (i.e. a real answer, not the greeting or an error message).
  const [rating, setRating] = useState(null);

  async function rate(value) {
    if (rating) return; // already rated
    setRating(value);   // optimistic
    try {
      await submitFeedback(question, answer, value, sources);
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 border border-uitm-border dark:border-gray-700 shadow-sm max-w-2xl">
      <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
        {renderBold(answer)}
      </div>

      {sources && sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-uitm-border dark:border-gray-700 space-y-2">
          {sources.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 min-w-0">
                <FileText size={13} className="text-uitm-gold flex-shrink-0" />
                <span className="font-medium text-uitm-maroon dark:text-uitm-gold truncate">{s.portal_name}</span>
                {s.title && s.title !== s.portal_name && (
                  <span className="text-gray-400 dark:text-gray-500 truncate">— {s.title}</span>
                )}
              </div>
              {s.url && s.url.startsWith('http') && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-uitm-maroon dark:text-uitm-gold hover:text-uitm-maroon-dark dark:hover:opacity-80 flex-shrink-0"
                >
                  Visit Portal <ExternalLink size={11} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feedback — only for real answers (greeting/errors pass no question) */}
      {question && (
        <div className="mt-3 pt-3 border-t border-uitm-border dark:border-gray-700 flex items-center gap-2">
          {rating ? (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {rating === 'up' ? 'Thanks for your feedback!' : 'Thanks — we’ll work on improving this.'}
            </span>
          ) : (
            <>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Was this helpful?</span>
              <button
                onClick={() => rate('up')}
                title="Helpful"
                className="p-1 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => rate('down')}
                title="Not helpful"
                className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <ThumbsDown size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
