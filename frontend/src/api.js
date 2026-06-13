const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

// ── Token helpers ──────────────────────────────────────────────────────────

export function getToken() {
  return sessionStorage.getItem('admin_token');
}

export function saveToken(token) {
  sessionStorage.setItem('admin_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('admin_token');
}

export function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function adminHeaders(extra = {}) {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

// Throws with status 401 if token is rejected so callers can redirect to login
async function adminFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    clearToken();
    throw Object.assign(new Error('Session expired. Please log in again.'), { status: 401 });
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function loginAdmin(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Invalid username or password.');
  if (!res.ok) throw new Error('Login failed. Is the backend running?');
  return res.json();
}

// ── Chat ───────────────────────────────────────────────────────────────────

export async function sendChat(message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export async function submitFeedback(question, answer, rating, sources) {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, rating, sources }),
  });
  if (!res.ok) throw new Error(`Feedback failed: ${res.status}`);
  return res.json();
}

export async function listFeedback() {
  return adminFetch(`${API_BASE}/admin/feedback`, {
    headers: adminHeaders(),
  });
}

export async function deleteFeedback(id) {
  return adminFetch(`${API_BASE}/admin/feedback/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function listSources() {
  return adminFetch(`${API_BASE}/admin/sources`, {
    headers: adminHeaders(),
  });
}

export async function addWebpage(url, portal_name) {
  return adminFetch(`${API_BASE}/admin/sources/webpage`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url, portal_name }),
  });
}

export async function addWebsite(url, portal_name, max_pages = 20) {
  return adminFetch(`${API_BASE}/admin/sources/website`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url, portal_name, max_pages }),
  });
}

export async function addText(title, content, portal_name) {
  return adminFetch(`${API_BASE}/admin/sources/text`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, content, portal_name }),
  });
}

export async function addDocument(file, portal_name, source_url) {
  const formData = new FormData();
  formData.append('file', file);
  if (portal_name) formData.append('portal_name', portal_name);
  if (source_url) formData.append('source_url', source_url);

  return adminFetch(`${API_BASE}/admin/sources/document`, {
    method: 'POST',
    headers: adminHeaders(),
    body: formData,
  });
}

export async function addFAQ(portal_name, faqs, source_url) {
  return adminFetch(`${API_BASE}/admin/sources/faq`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ portal_name, faqs, source_url }),
  });
}

export async function deleteSource(id) {
  return adminFetch(`${API_BASE}/admin/sources/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
}

// ── Seed Portals (UiTM Table 3.2) ──────────────────────────────────────────

export async function listSeedPortals() {
  return adminFetch(`${API_BASE}/admin/seed/portals`, {
    headers: adminHeaders(),
  });
}

export async function addSeedPortal(name, url, max_pages = 15) {
  return adminFetch(`${API_BASE}/admin/seed/portals`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, url, max_pages }),
  });
}

export async function updateSeedPortal(id, fields) {
  return adminFetch(`${API_BASE}/admin/seed/portals/${id}`, {
    method: 'PUT',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields),
  });
}

export async function deleteSeedPortal(id) {
  return adminFetch(`${API_BASE}/admin/seed/portals/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
}

export async function recrawlSeedPortal(id) {
  return adminFetch(`${API_BASE}/admin/seed/portals/${id}/recrawl`, {
    method: 'POST',
    headers: adminHeaders(),
  });
}

export async function runSeed() {
  return adminFetch(`${API_BASE}/admin/seed/run`, {
    method: 'POST',
    headers: adminHeaders(),
  });
}

export async function getSeedJob(jobId) {
  return adminFetch(`${API_BASE}/admin/seed/jobs/${jobId}`, {
    headers: adminHeaders(),
  });
}

// ── Analytics ──────────────────────────────────────────────────────────────

export async function getAnalytics(days = 30) {
  return adminFetch(`${API_BASE}/admin/analytics?days=${days}`, {
    headers: adminHeaders(),
  });
}
