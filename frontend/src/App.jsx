import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import QuickAccess from './components/QuickAccess';
import ChatWindow from './components/ChatWindow';
import AdminPanel from './components/AdminPanel';
import Preloader from './components/Preloader';
import { isTokenValid, clearToken } from './api';

function ProtectedRoute({ children }) {
  if (!isTokenValid()) {
    clearToken();
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [suggested, setSuggested]     = useState(null);
  const [isLoggedIn, setIsLoggedIn]   = useState(() => isTokenValid());
  const [isDark, setIsDark]           = useState(() => {
    const saved = localStorage.getItem('uitm-theme');
    return saved !== null ? saved === 'dark' : true;
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('uitm-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  function handleLoginSuccess() {
    setIsLoggedIn(true);
    // User can decide whether to open admin via the drawer button
  }

  function handleLogout() {
    clearToken();
    setIsLoggedIn(false);
    navigate('/');
  }

  function handleAdminClick() {
    navigate('/admin/portals');
  }

  function toggleTheme() {
    setIsDark((d) => !d);
  }

  // Props shared by both QuickAccess instances
  const sidebarCommon = {
    onLogout:       handleLogout,
    onLoginSuccess: handleLoginSuccess,
    onChatClick:    () => navigate('/'),
  };

  return (
    <>
    {!preloaderDone && <Preloader onDone={() => setPreloaderDone(true)} />}
    <Routes>
      {/* ── Chat page ── */}
      <Route
        path="/"
        element={
          <div className="flex h-screen overflow-hidden">
            <QuickAccess
              onSuggestionClick={(q) => setSuggested(q)}
              isLoggedIn={isLoggedIn}
              onAdminClick={handleAdminClick}
              isAdminPage={false}
              {...sidebarCommon}
            />
            <ChatWindow
              suggestedQuery={suggested}
              onQuerySent={() => setSuggested(null)}
              isDark={isDark}
              onToggleTheme={toggleTheme}
            />
          </div>
        }
      />

      {/* Convenience redirects */}
      <Route path="/admin"         element={<Navigate to="/admin/portals"         replace />} />
      <Route path="/admin/sources" element={<Navigate to="/admin/sources/website" replace />} />

      {/* ── Admin panel ── */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <div className="flex h-screen overflow-hidden">
              <QuickAccess
                onSuggestionClick={() => {}}
                isLoggedIn={true}
                onAdminClick={() => navigate('/')}
                isAdminPage={true}
                {...sidebarCommon}
              />
              <AdminPanel
                onLogout={handleLogout}
                isDark={isDark}
                onToggleTheme={toggleTheme}
              />
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
    </>
  );
}
