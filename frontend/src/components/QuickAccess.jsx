import { useState, useEffect } from 'react';
import {
  GraduationCap, BookOpen, Calendar, Award, CalendarDays, DollarSign,
  HelpCircle, Settings, LogOut, LogIn, MessageSquare, X, Lock,
  ExternalLink, ArrowLeft, Eye, EyeOff,
} from 'lucide-react';
import { loginAdmin, saveToken } from '../api';

const PORTALS = [
  { name: 'iStudent Portal',    url: 'https://istudent.uitm.edu.my/',                                   icon: GraduationCap },
  { name: 'Permata',            url: 'https://permata.uitm.edu.my/',                                    icon: BookOpen },
  { name: 'uFuture',            url: 'https://ufuture.uitm.edu.my/',                                    icon: Calendar },
  { name: 'Convocation',        url: 'https://konvokesyen.uitm.edu.my/v2/',                              icon: Award },
  { name: 'Academic Calendar',  url: 'https://hea.uitm.edu.my/index.php/calendars/academic-calendar',   icon: CalendarDays },
  { name: 'Bendahari (Fees)',   url: 'https://bendahari.uitm.edu.my/',                                  icon: DollarSign },
];

const SUGGESTED = [
  'How do I register my courses?',
  'Where can I check exam results?',
  'How to apply for a residential college ("kolej kediaman")?',
  'How to take class attendance?',
  'How to pay student bills?',
  'When is the convocation?',
];

function DockBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors group
        ${active ? 'bg-white/15' : 'hover:bg-white/10'}`}
    >
      {active && (
        <span className="absolute left-[-2px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-uitm-gold" />
      )}
      <Icon
        size={17}
        strokeWidth={1.75}
        className={`transition-colors ${active ? 'text-uitm-gold' : 'text-white/55 group-hover:text-uitm-gold'}`}
      />
      <span className={`text-[8px] font-semibold uppercase tracking-wider transition-colors
        ${active ? 'text-uitm-gold' : 'text-white/45 group-hover:text-uitm-gold'}`}>
        {label}
      </span>
    </button>
  );
}

export default function QuickAccess({
  onSuggestionClick,
  isLoggedIn,
  onAdminClick,
  onLogout,
  onLoginSuccess,
  onChatClick,
  isAdminPage,
}) {
  const [open, setOpen]               = useState('portals');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginUser, setLoginUser]     = useState('');
  const [loginPass, setLoginPass]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]   = useState('');
  const [showPass, setShowPass]       = useState(false);

  // Reset login form whenever the admin drawer is closed
  useEffect(() => {
    if (open !== 'admin') {
      setShowLoginForm(false);
      setLoginUser('');
      setLoginPass('');
      setLoginError('');
      setShowPass(false);
    }
  }, [open]);

  function toggle(key) {
    setOpen((prev) => (prev === key ? null : key));
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await loginAdmin(loginUser.trim(), loginPass);
      saveToken(data.token);
      onLoginSuccess();   // lift logged-in state to App
      onAdminClick();     // navigate straight to admin panel
    } catch (err) {
      setLoginError(err.message || 'Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  }

  const drawerTitle = {
    portals:   'Portal Links',
    questions: 'Suggested Questions',
    admin: isLoggedIn ? 'Admin Panel'
         : showLoginForm ? 'Sign In'
         : 'Admin Access',
  };

  return (
    <div className="flex h-full flex-shrink-0">

      {/* ── Dock ─────────────────────────────────────────── */}
      <nav className="w-[58px] bg-uitm-maroon flex flex-col items-center py-4 gap-1 flex-shrink-0 z-10">
        {/* Brand mark — click to go back to chat */}
        <button
          onClick={onChatClick}
          title="Back to Chat"
          className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center mb-3 flex-shrink-0 transition-colors"
        >
          <MessageSquare size={17} strokeWidth={1.75} className="text-uitm-gold" />
        </button>

        <DockBtn icon={GraduationCap} label="Portals"   active={open === 'portals'}   onClick={() => toggle('portals')} />
        <DockBtn icon={HelpCircle}    label="Ask"       active={open === 'questions'} onClick={() => toggle('questions')} />

        <div className="flex-1" />

        <DockBtn
          icon={Settings}
          label="Admin"
          active={open === 'admin'}
          onClick={() => isLoggedIn && !isAdminPage ? onAdminClick() : toggle('admin')}
        />
      </nav>

      {/* ── Drawer ───────────────────────────────────────── */}
      {open && (
        <div className={`w-56 ${open === 'questions' ? 'bg-purple-50' : 'bg-white'} dark:bg-gray-900 border-r border-uitm-border dark:border-gray-800 flex flex-col flex-shrink-0`}>

          {/* Drawer header */}
          <div className="px-4 py-3 border-b border-uitm-border dark:border-gray-800 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-uitm-maroon dark:text-uitm-gold">
              {drawerTitle[open]}
            </span>
            <button
              onClick={() => setOpen(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin py-2">

            {/* ── Portal links ── */}
            {open === 'portals' && (
              <nav className="px-2 space-y-0.5">
                {PORTALS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <a
                      key={p.name}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-gray-700 dark:text-gray-300
                        hover:bg-uitm-cream dark:hover:bg-gray-800 hover:text-uitm-maroon dark:hover:text-uitm-gold
                        group transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-uitm-maroon flex items-center justify-center flex-shrink-0">
                        <Icon size={13} strokeWidth={1.75} className="text-uitm-gold" />
                      </div>
                      <span className="text-[13px] leading-tight flex-1 min-w-0 truncate">{p.name}</span>
                      <ExternalLink
                        size={11}
                        className="flex-shrink-0 text-gray-300 dark:text-gray-600 opacity-0
                          group-hover:opacity-100 group-hover:text-uitm-gold transition-all"
                      />
                    </a>
                  );
                })}
              </nav>
            )}

            {/* ── Suggested questions ── */}
            {open === 'questions' && (
              <div className="px-2 space-y-1.5">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSuggestionClick(q)}
                    className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] leading-snug
                      text-gray-700 dark:text-gray-300 bg-purple-100 dark:bg-gray-800
                      hover:bg-purple-200 dark:hover:bg-uitm-gold/20 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* ── Admin section ── */}
            {open === 'admin' && (
              <div className="px-3 py-2 space-y-2">

                {/* Logged in */}
                {isLoggedIn && (
                  <>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed pb-1">
                      Signed in as administrator.
                    </p>
                    {isAdminPage && (
                      <button
                        onClick={onAdminClick}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium
                          bg-uitm-maroon hover:bg-uitm-maroon-dark text-white transition-colors"
                      >
                        <ArrowLeft size={14} />
                        Back to Chat
                      </button>
                    )}
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium
                        text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800
                        hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </>
                )}

                {/* Not logged in — prompt */}
                {!isLoggedIn && !showLoginForm && (
                  <>
                    <div className="flex gap-2.5 items-start pb-1">
                      <div className="w-8 h-8 rounded-lg bg-uitm-maroon/10 dark:bg-uitm-maroon/20
                        flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lock size={14} className="text-uitm-maroon dark:text-uitm-gold" />
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        Sign in to manage the knowledge base.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowLoginForm(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium
                        bg-uitm-maroon hover:bg-uitm-maroon-dark text-white transition-colors"
                    >
                      <LogIn size={14} />
                      Sign In
                    </button>
                  </>
                )}

                {/* Not logged in — inline login form */}
                {!isLoggedIn && showLoginForm && (
                  <form onSubmit={handleLogin} className="space-y-3">
                    {/* Back link */}
                    <button
                      type="button"
                      onClick={() => { setShowLoginForm(false); setLoginError(''); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400
                        hover:text-uitm-maroon dark:hover:text-uitm-gold transition-colors"
                    >
                      <ArrowLeft size={12} /> Back
                    </button>

                    {/* Username */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider
                        text-gray-600 dark:text-gray-400 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        placeholder="admin"
                        autoComplete="username"
                        required
                        className="w-full rounded-lg border border-uitm-border dark:border-gray-700
                          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200
                          placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-[13px]
                          focus:outline-none focus:border-uitm-gold focus:ring-1 focus:ring-uitm-gold"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider
                        text-gray-600 dark:text-gray-400 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          required
                          className="w-full rounded-lg border border-uitm-border dark:border-gray-700
                            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200
                            placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 pr-9 text-[13px]
                            focus:outline-none focus:border-uitm-gold focus:ring-1 focus:ring-uitm-gold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400
                            hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    {loginError && (
                      <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                        border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1.5 leading-snug">
                        {loginError}
                      </p>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loginLoading || !loginUser.trim() || !loginPass.trim()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                        text-[13px] font-medium bg-uitm-maroon hover:bg-uitm-maroon-dark
                        disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      <LogIn size={14} />
                      {loginLoading ? 'Signing in…' : 'Sign In'}
                    </button>
                  </form>
                )}

              </div>
            )}
          </div>

          {/* Footer — portals & questions only */}
          {open !== 'admin' && (
            <div className="px-4 py-3 border-t border-uitm-border dark:border-gray-800 flex-shrink-0">
              <p className="text-[10px] font-semibold text-uitm-maroon dark:text-uitm-gold font-display">UiTM Virtual Assistant</p>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Powered by RAG &amp; NLP</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
