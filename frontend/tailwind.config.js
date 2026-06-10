/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        uitm: {
          // ── Chat / sidebar (purple theme) ──────────────────
          maroon:        '#6B21A8', // purple-800
          'maroon-dark': '#581C87', // purple-900
          // ── Admin panel (original red theme) ───────────────
          red:           '#6B1E35',
          'red-dark':    '#4F1527',
          // ── Shared ─────────────────────────────────────────
          gold:          '#C9A961',
          cream:         '#FDF8F3', // light backgrounds
          'chat-bg':     '#EDE7F6', // light-mode chat area (soft lavender)
          border:        '#C4ADE0', // visible light-mode border (purple-tinted)
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
