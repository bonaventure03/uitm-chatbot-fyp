import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, FileText, Type, HelpCircle, Link2, Trash2, Plus, Upload, X, Database, RefreshCw, Pencil, Save, MessageSquare, ChevronDown, ChevronRight, BarChart2, ThumbsDown, AlertTriangle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import {
  listSources, addWebpage, addWebsite, addText, addDocument, addFAQ, deleteSource,
  listSeedPortals, addSeedPortal, updateSeedPortal, deleteSeedPortal, recrawlSeedPortal, runSeed, getSeedJob,
  listFeedback, deleteFeedback, getAnalytics,
} from '../api';

const SOURCE_TABS = [
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'webpage', label: 'Webpage', icon: Link2 },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

const PAGE_TITLES = {
  'portals':    { title: 'UiTM Portals',      subtitle: 'Configure and manage seed portals for the knowledge base' },
  'add-source': { title: 'Add Data Source',   subtitle: 'Index new websites, documents, or text into the vector database' },
  'feedback':   { title: 'Negative Feedback', subtitle: 'Review and manage low-rated responses from students' },
  'analytics':  { title: 'Analytics',         subtitle: 'Usage statistics and knowledge base health overview' },
};

function formatDate(isoString) {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

const VALID_SOURCE_TABS = ['website', 'webpage', 'document', 'text', 'faq'];

export default function AdminPanel({ onLogout, isDark, onToggleTheme }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Derive active tabs from the URL path
  const parts = pathname.split('/'); // ['', 'admin', 'portals'] or ['', 'admin', 'sources', 'website']
  const mainTab = parts[2] === 'sources' ? 'add-source'
                : parts[2] === 'feedback'  ? 'feedback'
                : parts[2] === 'analytics' ? 'analytics'
                : 'portals';
  const rawSourceTab = parts[3] || 'website';
  const activeSourceTab = VALID_SOURCE_TABS.includes(rawSourceTab) ? rawSourceTab : 'website';

  const [sources, setSources] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => { refreshSources(); }, []);

  async function refreshSources() {
    try {
      const data = await listSources();
      setSources(data.sources || []);
    } catch (e) {
      if (e.status === 401) { onLogout(); return; }
      console.error(e);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this data source? Associated chunks will be removed from the vector database.')) return;
    try {
      await deleteSource(id);
      showToast('Source deleted');
      refreshSources();
    } catch (e) {
      if (e.status === 401) { onLogout(); return; }
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  const page = PAGE_TITLES[mainTab] ?? PAGE_TITLES['portals'];

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-uitm-cream/40 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-uitm-border dark:border-gray-800 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-uitm-red dark:text-uitm-gold">{page.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{page.subtitle}</p>
          </div>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left panel ── */}
          <section className={(mainTab === 'feedback' || mainTab === 'analytics') ? 'lg:col-span-5' : 'lg:col-span-3'}>
            {/* Tab content */}
            {mainTab === 'portals' && (
              <SeedPortalsPanel
                showToast={showToast}
                onAuthError={onLogout}
              />
            )}

            {mainTab === 'feedback' && (
              <FeedbackPanel
                showToast={showToast}
                onAuthError={onLogout}
              />
            )}

            {mainTab === 'analytics' && (
              <AnalyticsPanel onAuthError={onLogout} />
            )}

            {mainTab === 'add-source' && (
              <div>
                {/* Source sub-tabs */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {SOURCE_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = activeSourceTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/admin/sources/${t.id}`)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
                          active
                            ? 'bg-uitm-red text-white border-uitm-red'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-uitm-border dark:border-gray-700 hover:border-uitm-gold'
                        }`}
                      >
                        <Icon size={14} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-uitm-border dark:border-gray-800">
                  {activeSourceTab === 'website'  && <WebsiteForm  onSuccess={(m) => { showToast(m); refreshSources(); }} onError={(m) => showToast(m, 'error')} />}
                  {activeSourceTab === 'webpage'  && <WebpageForm  onSuccess={(m) => { showToast(m); refreshSources(); }} onError={(m) => showToast(m, 'error')} />}
                  {activeSourceTab === 'document' && <DocumentForm onSuccess={(m) => { showToast(m); refreshSources(); }} onError={(m) => showToast(m, 'error')} />}
                  {activeSourceTab === 'text'     && <TextForm     onSuccess={(m) => { showToast(m); refreshSources(); }} onError={(m) => showToast(m, 'error')} />}
                  {activeSourceTab === 'faq'      && <FAQForm      onSuccess={(m) => { showToast(m); refreshSources(); }} onError={(m) => showToast(m, 'error')} />}
                </div>
              </div>
            )}
          </section>

          {/* ── Right panel: Active Sources ── */}
          {mainTab !== 'feedback' && mainTab !== 'analytics' && (
          <section className="lg:col-span-2">
            <h2 className="font-display text-lg font-semibold text-uitm-red dark:text-uitm-gold mb-4 flex items-center gap-2">
              <Database size={18} /> Active Sources
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">({sources.length})</span>
            </h2>

            {sources.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-dashed border-uitm-border dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                No data sources yet. Add your first one from the left.
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
                {sources.map((s) => (
                  <div key={s.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-uitm-border dark:border-gray-700 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-uitm-gold bg-uitm-gold/10 px-2 py-0.5 rounded">
                          {s.source_type}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{s.chunk_count} chunks</span>
                      </div>
                      <p className="text-sm font-medium text-uitm-red dark:text-uitm-gold truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{s.url}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                      title="Delete source"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============ SHARED FORM PRIMITIVES ============

function FieldLabel({ children }) {
  return <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">{children}</label>;
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-uitm-border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:border-uitm-gold focus:ring-1 focus:ring-uitm-gold"
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-uitm-border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:border-uitm-gold focus:ring-1 focus:ring-uitm-gold"
    />
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="bg-uitm-red hover:bg-uitm-red-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
    >
      {loading ? 'Processing…' : children}
    </button>
  );
}

// ============ ADD-SOURCE FORMS ============

function WebsiteForm({ onSuccess, onError }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await addWebsite(url, name, maxPages);
      onSuccess(`Crawled ${r.source.pages_crawled} pages, indexed ${r.source.chunk_count} chunks`);
      setUrl(''); setName('');
    } catch (e) { onError(e.message); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Crawl a full website. The bot will follow links within the same domain up to the page limit.</p>
      <div><FieldLabel>Root URL</FieldLabel><Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://bendahari.uitm.edu.my/" /></div>
      <div><FieldLabel>Portal Name (optional)</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bendahari (Bursary)" /></div>
      <div><FieldLabel>Max Pages to Crawl</FieldLabel><Input type="number" min={1} max={100} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} /></div>
      <SubmitBtn loading={loading}>Crawl &amp; Index</SubmitBtn>
    </form>
  );
}

function WebpageForm({ onSuccess, onError }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await addWebpage(url, name);
      onSuccess(`Indexed ${r.source.chunk_count} chunks`);
      setUrl(''); setName('');
    } catch (e) { onError(e.message); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Add a single webpage as a data source.</p>
      <div><FieldLabel>URL</FieldLabel><Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hep.uitm.edu.my/main/index.php/pelajar/sahsiah-rupa-diri-pelajar" /></div>
      <div><FieldLabel>Portal Name (optional)</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HEP Dress Code" /></div>
      <SubmitBtn loading={loading}>Fetch &amp; Index</SubmitBtn>
    </form>
  );
}

function DocumentForm({ onSuccess, onError }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const r = await addDocument(file, name, sourceUrl);
      onSuccess(`Uploaded ${file.name}, indexed ${r.source.chunk_count} chunks`);
      setFile(null); setName(''); setSourceUrl('');
    } catch (e) { onError(e.message); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Upload PDF, DOCX, TXT, or image files (PNG, JPG, etc.) — ideal for exported documents, screenshots of portals, or notice board images. Images are analysed with Claude Vision to extract their text and content.</p>
      <div>
        <FieldLabel>File</FieldLabel>
        <label className="flex items-center gap-2 border border-dashed border-uitm-border dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-uitm-gold transition">
          <Upload size={18} className="text-uitm-gold" />
          <span className="text-sm text-gray-700 dark:text-gray-300">{file ? file.name : 'Click to choose a file (PDF, DOCX, TXT, PNG, JPG…)'}</span>
          <input type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
      </div>
      <div><FieldLabel>Portal Name (optional)</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Permata - Past Exam Papers" /></div>
      <div><FieldLabel>Original Source URL (optional)</FieldLabel><Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://permata.uitm.edu.my/" /></div>
      <SubmitBtn loading={loading}>Upload &amp; Index</SubmitBtn>
    </form>
  );
}

function TextForm({ onSuccess, onError }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await addText(title, content, name);
      onSuccess(`Indexed ${r.source.chunk_count} chunks`);
      setTitle(''); setContent(''); setName('');
    } catch (e) { onError(e.message); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Paste custom content directly — useful for quick announcements or summaries.</p>
      <div><FieldLabel>Title</FieldLabel><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Semester 1 2025/2026 Key Dates" /></div>
      <div><FieldLabel>Portal Name (optional)</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Academic Affairs" /></div>
      <div><FieldLabel>Content</FieldLabel><Textarea required rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste your content here..." /></div>
      <SubmitBtn loading={loading}>Add &amp; Index</SubmitBtn>
    </form>
  );
}

function FAQForm({ onSuccess, onError }) {
  const [portalName, setPortalName] = useState('UiTM FAQ');
  const [sourceUrl, setSourceUrl] = useState('');
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);
  const [loading, setLoading] = useState(false);

  function updateFaq(i, field, val) {
    const copy = [...faqs];
    copy[i][field] = val;
    setFaqs(copy);
  }
  function addRow() { setFaqs([...faqs, { question: '', answer: '' }]); }
  function removeRow(i) { setFaqs(faqs.filter((_, idx) => idx !== i)); }

  async function submit(e) {
    e.preventDefault();
    const filtered = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (filtered.length === 0) { onError('Add at least one complete Q&A'); return; }
    setLoading(true);
    try {
      const r = await addFAQ(portalName, filtered, sourceUrl);
      onSuccess(`Added ${filtered.length} FAQs, indexed ${r.source.chunk_count} chunks`);
      setFaqs([{ question: '', answer: '' }]);
    } catch (e) { onError(e.message); }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Add Q&amp;A pairs. Each pair is embedded separately for precise matching.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Portal Name</FieldLabel><Input value={portalName} onChange={(e) => setPortalName(e.target.value)} /></div>
        <div><FieldLabel>Source URL (optional)</FieldLabel><Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://faqsso.uitm.edu.my/" /></div>
      </div>
      <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin pr-1">
        {faqs.map((f, i) => (
          <div key={i} className="bg-uitm-cream/40 dark:bg-gray-800/60 rounded-lg p-3 border border-uitm-border dark:border-gray-700 relative">
            {faqs.length > 1 && (
              <button type="button" onClick={() => removeRow(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            )}
            <Input value={f.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} placeholder="Question" />
            <Textarea rows={2} value={f.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} placeholder="Answer" />
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="text-sm text-uitm-red dark:text-uitm-gold hover:text-uitm-red-dark dark:hover:opacity-80 flex items-center gap-1 font-medium">
        <Plus size={14} /> Add another FAQ
      </button>
      <SubmitBtn loading={loading}>Save FAQs</SubmitBtn>
    </form>
  );
}

// ============ SEED PORTALS PANEL ============

const SEED_JOB_KEY = 'uitm_seed_job';
const RECRAWL_JOB_KEY = 'uitm_recrawl_job';

function SeedPortalsPanel({ showToast, onAuthError }) {
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [recrawlingId, setRecrawlingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // Stable refs so polling callbacks always call the latest versions
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;
  const seedIntervalRef = useRef(null);
  const recrawlIntervalRef = useRef(null);

  function refresh() {
    setLoading(true);
    listSeedPortals()
      .then((data) => setPortals(data.portals || []))
      .catch((e) => {
        if (e.status === 401) onAuthErrorRef.current();
        else console.error(e);
      })
      .finally(() => setLoading(false));
  }

  function _startSeedPoll(jobId) {
    if (seedIntervalRef.current) clearInterval(seedIntervalRef.current);
    seedIntervalRef.current = setInterval(async () => {
      try {
        const job = await getSeedJob(jobId);
        if (job.status === 'done' || job.status === 'not_found') {
          clearInterval(seedIntervalRef.current);
          seedIntervalRef.current = null;
          sessionStorage.removeItem(SEED_JOB_KEY);
          setSeeding(false);
          if (job.status === 'done' && job.result) {
            const { results, total_chunks } = job.result;
            const failed = results.filter((x) => !x.success).length;
            const count = results.length;
            if (failed > 0) {
              showToastRef.current(`Re-seeded ${count - failed}/${count} portals (${total_chunks} chunks). ${failed} failed.`, 'error');
            } else {
              showToastRef.current(`Re-seeded all ${count} portals — ${total_chunks} chunks total`);
            }
          }
          refresh();
        } else if (job.status === 'error') {
          clearInterval(seedIntervalRef.current);
          seedIntervalRef.current = null;
          sessionStorage.removeItem(SEED_JOB_KEY);
          setSeeding(false);
          showToastRef.current(`Seed error: ${job.error}`, 'error');
          refresh();
        }
      } catch (e) {
        if (e.status === 401) { onAuthErrorRef.current(); return; }
        clearInterval(seedIntervalRef.current);
        seedIntervalRef.current = null;
        sessionStorage.removeItem(SEED_JOB_KEY);
        setSeeding(false);
      }
    }, 3000);
  }

  function _startRecrawlPoll(jobId, portalId) {
    if (recrawlIntervalRef.current) clearInterval(recrawlIntervalRef.current);
    recrawlIntervalRef.current = setInterval(async () => {
      try {
        const job = await getSeedJob(jobId);
        if (job.status === 'done' || job.status === 'not_found') {
          clearInterval(recrawlIntervalRef.current);
          recrawlIntervalRef.current = null;
          sessionStorage.removeItem(RECRAWL_JOB_KEY);
          setRecrawlingId(null);
          if (job.status === 'done' && job.result?.portal) {
            const p = job.result.portal;
            showToastRef.current(`Re-crawled "${p.name}": ${p.last_chunk_count} chunks`);
          }
          refresh();
        } else if (job.status === 'error') {
          clearInterval(recrawlIntervalRef.current);
          recrawlIntervalRef.current = null;
          sessionStorage.removeItem(RECRAWL_JOB_KEY);
          setRecrawlingId(null);
          showToastRef.current(`Re-crawl error: ${job.error}`, 'error');
          refresh();
        }
      } catch (e) {
        if (e.status === 401) { onAuthErrorRef.current(); return; }
        clearInterval(recrawlIntervalRef.current);
        recrawlIntervalRef.current = null;
        sessionStorage.removeItem(RECRAWL_JOB_KEY);
        setRecrawlingId(null);
      }
    }, 3000);
  }

  useEffect(() => {
    // Resume any jobs that were running before the user navigated away
    const storedSeedJob = sessionStorage.getItem(SEED_JOB_KEY);
    const storedRecrawlJob = sessionStorage.getItem(RECRAWL_JOB_KEY);
    if (storedSeedJob) {
      setSeeding(true);
      _startSeedPoll(storedSeedJob);
    }
    if (storedRecrawlJob) {
      const { jobId, portalId } = JSON.parse(storedRecrawlJob);
      setRecrawlingId(portalId);
      _startRecrawlPoll(jobId, portalId);
    }
    refresh();
    return () => {
      if (seedIntervalRef.current) clearInterval(seedIntervalRef.current);
      if (recrawlIntervalRef.current) clearInterval(recrawlIntervalRef.current);
    };
  }, []);

  async function handleUpdate(id, fields) {
    try {
      await updateSeedPortal(id, fields);
      showToast('Portal updated');
      setEditingId(null);
      refresh();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete portal "${name}" and remove its chunks from the vector DB?`)) return;
    try {
      await deleteSeedPortal(id);
      showToast('Portal deleted');
      refresh();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  async function handleRecrawl(id) {
    if (recrawlingId) return;
    setRecrawlingId(id);
    try {
      const r = await recrawlSeedPortal(id);
      sessionStorage.setItem(RECRAWL_JOB_KEY, JSON.stringify({ jobId: r.job_id, portalId: id }));
      _startRecrawlPoll(r.job_id, id);
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
      setRecrawlingId(null);
    }
  }

  async function handleAdd(name, url, maxPages) {
    try {
      await addSeedPortal(name, url, maxPages);
      showToast('Portal added');
      setShowAddForm(false);
      refresh();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  function handleRunSeed() {
    if (portals.length === 0) return;
    setShowSeedConfirm(true);
  }

  async function confirmRunSeed() {
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      const r = await runSeed();
      if (r.job_id) {
        sessionStorage.setItem(SEED_JOB_KEY, r.job_id);
        _startSeedPoll(r.job_id);
      } else {
        // Empty portal list — backend returned immediately
        setSeeding(false);
        refresh();
      }
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
      setSeeding(false);
    }
  }

  return (
    <>
    {showSeedConfirm && (
      <ConfirmSeedModal
        count={portals.length}
        onConfirm={confirmRunSeed}
        onCancel={() => setShowSeedConfirm(false)}
      />
    )}
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-uitm-border dark:border-gray-800 bg-uitm-cream/20 dark:bg-gray-800/40">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {loading ? 'Loading…' : `${portals.length} portal${portals.length !== 1 ? 's' : ''} configured`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-uitm-border dark:border-gray-600 hover:border-uitm-gold disabled:opacity-40 transition"
          >
            <Plus size={12} /> Add Portal
          </button>
          <button
            onClick={handleRunSeed}
            disabled={seeding || portals.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-uitm-red hover:bg-uitm-red-dark disabled:opacity-50 text-white transition"
          >
            <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
            {seeding ? 'Re-seeding…' : 'Update Seed'}
          </button>
        </div>
      </div>

      {/* Seeding progress bar */}
      {seeding && (
        <div className="px-5 py-3 border-b border-uitm-border dark:border-gray-800 bg-purple-50/60 dark:bg-gray-800/30">
          <p className="text-xs text-uitm-red dark:text-uitm-gold font-medium mb-2">
            Re-seeding all portals — this may take 2–5 minutes…
          </p>
          <div className="relative h-1.5 bg-purple-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute h-full w-2/5 bg-uitm-red dark:bg-uitm-gold rounded-full animate-progress" />
          </div>
        </div>
      )}

      {/* Add portal inline form */}
      {showAddForm && (
        <div className="px-5 py-4 border-b border-uitm-border dark:border-gray-800 bg-uitm-cream/10 dark:bg-gray-800/20">
          <AddPortalForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Portal list */}
      {loading && portals.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : portals.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No portals configured yet. Click <b>Add Portal</b> to add one.
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          {portals.map((p, i) => (
            <PortalRow
              key={p.id}
              portal={p}
              isFirst={i === 0}
              isEditing={editingId === p.id}
              isRecrawling={recrawlingId === p.id}
              onStartEdit={() => setEditingId(p.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(fields) => handleUpdate(p.id, fields)}
              onDelete={() => handleDelete(p.id, p.name)}
              onRecrawl={() => handleRecrawl(p.id)}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function ConfirmSeedModal({ count, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-uitm-border dark:border-gray-700 max-w-sm w-full mx-4 p-6">
        <h3 className="font-display text-lg font-semibold text-uitm-red dark:text-uitm-gold mb-3">
          Update Seed
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
          This will re-crawl all <strong className="text-gray-800 dark:text-gray-200">{count} portal{count !== 1 ? 's' : ''}</strong>.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
          Existing chunks for these portals will be wiped first. Admin-added documents, text, and FAQs are <em>not</em> affected.
        </p>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-3 mb-5">
          ⏱ This can take 2–5 minutes. Continue?
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 border border-uitm-border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-uitm-red hover:bg-uitm-red-dark text-white transition"
          >
            Yes, Update Seed
          </button>
        </div>
      </div>
    </div>
  );
}

function PortalRow({ portal, isFirst, isEditing, isRecrawling, onStartEdit, onCancelEdit, onSave, onDelete, onRecrawl }) {
  const [name, setName] = useState(portal.name);
  const [url, setUrl] = useState(portal.url);
  const [maxPages, setMaxPages] = useState(portal.max_pages);

  useEffect(() => {
    setName(portal.name);
    setUrl(portal.url);
    setMaxPages(portal.max_pages);
  }, [portal, isEditing]);

  const borderClass = isFirst ? '' : 'border-t border-uitm-border dark:border-gray-800';

  if (isEditing) {
    return (
      <div className={`p-4 ${borderClass} bg-uitm-cream/20 dark:bg-gray-800/40`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
          <div className="md:col-span-4">
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-6">
            <FieldLabel>URL</FieldLabel>
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Max Pages</FieldLabel>
            <Input type="number" min={1} max={100} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onSave({ name, url, max_pages: maxPages })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-uitm-red hover:bg-uitm-red-dark text-white transition"
          >
            <Save size={13} /> Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const lastSeeded = portal.last_seeded_at
    ? formatDate(portal.last_seeded_at)
    : 'Never';

  return (
    <div className={borderClass}>
      <div className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-uitm-cream/10 dark:hover:bg-gray-800/30 transition">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-uitm-red dark:text-uitm-gold truncate">{portal.name}</p>
          <a
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-uitm-gold truncate block mt-0.5"
          >
            {portal.url}
          </a>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <span>Max: {portal.max_pages} pages</span>
            <span>•</span>
            <span>Seeded: {lastSeeded}</span>
            {portal.last_chunk_count > 0 && (
              <>
                <span>•</span>
                <span>{portal.last_chunk_count} chunks</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRecrawl}
            disabled={isRecrawling}
            className="p-1.5 text-gray-400 hover:text-uitm-red dark:hover:text-uitm-gold transition disabled:opacity-50"
            title="Re-crawl this portal"
          >
            <RefreshCw size={14} className={isRecrawling ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onStartEdit}
            disabled={isRecrawling}
            className="p-1.5 text-gray-400 hover:text-uitm-red dark:hover:text-uitm-gold transition disabled:opacity-40"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={isRecrawling}
            className="p-1.5 text-gray-400 hover:text-red-500 transition disabled:opacity-40"
            title="Delete portal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isRecrawling && (
        <div className="px-5 pb-3">
          <p className="text-[11px] text-uitm-red dark:text-uitm-gold mb-1.5">Re-crawling portal…</p>
          <div className="relative h-1 bg-purple-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute h-full w-1/3 bg-uitm-red dark:bg-uitm-gold rounded-full animate-progress" />
          </div>
        </div>
      )}
    </div>
  );
}

function AddPortalForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(15);

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onAdd(name.trim(), url.trim(), maxPages);
    setName(''); setUrl(''); setMaxPages(15);
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
        <div className="md:col-span-4">
          <FieldLabel>Portal Name</FieldLabel>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PTAR Library" />
        </div>
        <div className="md:col-span-6">
          <FieldLabel>Root URL</FieldLabel>
          <Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Max Pages</FieldLabel>
          <Input type="number" min={1} max={100} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-uitm-red hover:bg-uitm-red-dark text-white transition">
          <Plus size={13} /> Add
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          Cancel
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Click <b>Update Seed</b> after adding to crawl the new portal.</p>
      </div>
    </form>
  );
}

// ============ ANALYTICS PANEL ============

const RANGE_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function AnalyticsPanel({ onAuthError }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState(30);

  useEffect(() => {
    setLoading(true);
    getAnalytics(days)
      .then(setData)
      .catch((e) => { if (e.status === 401) onAuthError(); })
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-uitm-red dark:text-uitm-gold flex items-center gap-2">
          <BarChart2 size={18} /> Analytics
        </h2>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                days === d
                  ? 'bg-uitm-red text-white border-uitm-red'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-uitm-border dark:border-gray-700 hover:border-uitm-gold'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center">Loading analytics…</div>
      ) : !data ? null : (
        <>
          {/* Chat logging is broken — say so instead of showing a page of zeros */}
          {data.log_error && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-0.5">Chat logging unavailable — usage stats below will stay empty.</p>
                <p className="opacity-80">Run <code>backend/supabase_schema.sql</code> in the Supabase SQL Editor to create the <code>chat_logs</code> table.</p>
                <p className="opacity-60 mt-1 font-mono break-all">{data.log_error}</p>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Questions"  value={data.total_questions.toLocaleString()} icon="📨" />
            <StatCard label="Satisfaction"     value={!data.feedback_count ? '—' : `${Math.round(data.satisfaction_rate * 100)}%`} icon="👍" color="text-emerald-500" />
            <StatCard label="Fallback Rate"    value={data.total_questions === 0 ? '—' : `${Math.round(data.fallback_rate * 100)}%`}    icon="❓" color="text-amber-500" />
            <StatCard label="Indexed Sources"  value={data.sources_count}                                                                icon="🗂" />
          </div>

          {/* Chart + Top questions */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Questions per Day <span className="normal-case font-normal">(last 14 days)</span></p>
              <DailyChart data={data.daily_counts} />
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-uitm-border dark:border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Top Asked Questions</p>
              </div>
              <TopQuestionsTable rows={data.top_questions} />
            </div>
          </div>

          {/* Topics + KB health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Topic Distribution</p>
              <TopicBars topics={data.topics} />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-uitm-border dark:border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Knowledge Base Health</p>
              </div>
              <KBHealthTable rows={data.kb_health} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-gray-900 dark:text-gray-100' }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{icon} {label}</p>
      <p className={`text-3xl font-bold leading-none ${color}`}>{value}</p>
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400">No data yet.</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 540, H = 140, PAD_L = 8, BAR_GAP = 4;
  const barW = (W - PAD_L) / data.length - BAR_GAP;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 22}`} className="overflow-visible">
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * H, d.count > 0 ? 4 : 0);
        const x = PAD_L + i * ((W - PAD_L) / data.length);
        const y = H - barH;
        const isMax = d.count === max && max > 0;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              className={isMax ? 'fill-uitm-gold' : 'fill-uitm-red'}
              opacity={0.85} />
            <title>{`${d.date}: ${d.count} questions`}</title>
            <text x={x + barW / 2} y={H + 14} textAnchor="middle"
              className="fill-gray-400 dark:fill-gray-500 text-[9px]" fontSize={9}>
              {d.date.slice(5)}
            </text>
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400" fontSize={8}>
                {d.count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TopQuestionsTable({ rows }) {
  if (!rows || rows.length === 0) return (
    <p className="text-sm text-gray-400 p-5">No questions logged yet.</p>
  );
  return (
    <div className="divide-y divide-uitm-border dark:divide-gray-800">
      {rows.map((r, i) => {
        const sat = r.satisfaction;
        const chipColor = sat === null ? 'text-gray-400' : sat >= 0.75 ? 'text-emerald-500' : sat >= 0.5 ? 'text-amber-500' : 'text-red-400';
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[11px] font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
            <p className="flex-1 text-xs text-gray-800 dark:text-gray-200 truncate">{r.question}</p>
            <span className="text-xs font-semibold text-uitm-gold flex-shrink-0">{r.count}×</span>
            <span className={`text-[11px] font-semibold flex-shrink-0 w-9 text-right ${chipColor}`}>
              {sat !== null ? `${Math.round(sat * 100)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopicBars({ topics }) {
  if (!topics || topics.length === 0) return <p className="text-sm text-gray-400">No data yet.</p>;
  const max = Math.max(...topics.map(t => t.pct), 1);
  return (
    <div className="space-y-3">
      {topics.map((t) => (
        <div key={t.name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-300">{t.name}</span>
            <span className="font-semibold text-gray-500 dark:text-gray-400">{t.pct}%</span>
          </div>
          <div className="h-1.5 bg-uitm-border dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-uitm-red to-uitm-gold"
              style={{ width: `${(t.pct / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function KBHealthTable({ rows }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-gray-400 p-5">No portals configured.</p>;
  function badge(daysAgo) {
    if (daysAgo === null) return <span className="text-[11px] text-gray-400">Never seeded</span>;
    if (daysAgo <= 7)  return <span className="text-[11px] font-semibold text-emerald-500">✅ {daysAgo}d ago</span>;
    if (daysAgo <= 30) return <span className="text-[11px] font-semibold text-amber-500">⚠️ {daysAgo}d ago</span>;
    return <span className="text-[11px] font-semibold text-red-400">🔴 {daysAgo}d ago</span>;
  }
  return (
    <div className="divide-y divide-uitm-border dark:divide-gray-800">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-2.5">
          <p className="flex-1 text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{r.name}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{r.chunks} chunks</span>
          <span className="flex-shrink-0">{badge(r.days_ago)}</span>
        </div>
      ))}
    </div>
  );
}

// ============ NEGATIVE FEEDBACK PANEL ============

function FeedbackPanel({ showToast, onAuthError }) {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  function refresh(initial = false) {
    if (initial) setLoading(true);
    listFeedback()
      .then((data) => {
        setGroups(data.groups || []);
        setTotal(data.total || 0);
      })
      .catch((e) => {
        if (e.status === 401) onAuthError();
        else console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(true); }, []);

  function toggle(key) {
    setExpanded((m) => ({ ...m, [key]: !m[key] }));
  }

  async function handleDelete(id) {
    if (!confirm('Delete this feedback entry? This cannot be undone.')) return;
    try {
      await deleteFeedback(id);
      showToast('Feedback deleted');
      refresh();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-uitm-border dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-uitm-border dark:border-gray-800 bg-uitm-cream/20 dark:bg-gray-800/40">
        <div className="flex items-center gap-2">
          <ThumbsDown size={15} className="text-uitm-red dark:text-uitm-gold" />
          <p className="text-sm font-medium text-uitm-red dark:text-uitm-gold">
            Answers marked “not helpful”
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {total} entr{total !== 1 ? 'ies' : 'y'} · {groups.length} question{groups.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => refresh()}
            className="p-1.5 text-gray-400 hover:text-uitm-red dark:hover:text-uitm-gold transition"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          <ThumbsDown size={28} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          No negative feedback yet. When students mark an answer as not helpful,
          it will appear here grouped by question.
        </div>
      ) : (
        <div className="divide-y divide-uitm-border dark:divide-gray-800 max-h-[640px] overflow-y-auto scrollbar-thin">
          {groups.map((g) => {
            const key = g.question.trim().toLowerCase();
            const isOpen = !!expanded[key];
            return (
              <div key={key}>
                {/* Group header */}
                <button
                  onClick={() => toggle(key)}
                  className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-uitm-cream/10 dark:hover:bg-gray-800/30 transition"
                >
                  {isOpen ? (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                      {g.question}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Last reported {formatDate(g.latest)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] font-semibold text-uitm-red dark:text-uitm-gold bg-uitm-red/10 dark:bg-uitm-gold/10 px-2 py-0.5 rounded-full">
                    {g.count}×
                  </span>
                </button>

                {/* Expanded items */}
                {isOpen && (
                  <div className="px-5 pb-4 pl-12 space-y-3">
                    {g.items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-uitm-cream/30 dark:bg-gray-800/50 rounded-lg p-3 border border-uitm-border dark:border-gray-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                            <MessageSquare size={12} />
                            {formatDate(it.created_at)}
                          </div>
                          <button
                            onClick={() => handleDelete(it.id)}
                            className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                            title="Delete this entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-[13px] text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">
                          {it.answer}
                        </p>
                        {it.sources && it.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-uitm-border dark:border-gray-700 flex flex-wrap gap-1.5">
                            {it.sources.map((s, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-uitm-maroon dark:text-uitm-gold bg-uitm-gold/10 px-2 py-0.5 rounded"
                              >
                                {s.portal_name || s.title || 'source'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
