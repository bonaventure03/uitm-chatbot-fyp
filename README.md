# UiTM Campus Assistant Chatbot

Access online at https://uitm-chatbot.vercel.app/

A RAG-powered chatbot that answers UiTM Samarahan student queries with step-by-step guides and portal links.

**Final Year Project** — CSP600 / CSP650, Bonaventure Tindin, CDCS2303A

---

## Tech Stack

| Layer | Tool |
|-------|------|
| LLM | Anthropic Claude Sonnet 4.6 |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| Vector DB | Pinecone (serverless, cosine) |
| Orchestration | LangChain |
| Backend | FastAPI + Uvicorn + SlowAPI (rate limiting) |
| Auth | JWT + bcrypt (admin routes) |
| Storage | Supabase (document files + chat feedback) |
| Frontend | React 18 + Vite + Tailwind CSS + React Router v7 |
| Icons | lucide-react |
| Web scraping | BeautifulSoup, requests, Selenium |
| Document parsing | pdfplumber, python-docx |
| Backend deploy | Railway (nixpacks — includes Chromium for Selenium) |
| Frontend deploy | Vercel |

---

## Project Structure

```
uitm-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, rate limiter
│   │   ├── config.py            Loads and validates .env
│   │   ├── limiter.py           SlowAPI rate limiter instance
│   │   └── api/
│   │       ├── chat.py          POST /api/chat
│   │       ├── admin.py         Knowledge base CRUD
│   │       ├── seed.py          Seed portal management
│   │       ├── auth.py          Admin login / JWT
│   │       └── feedback.py      Chat feedback endpoint
│   │   └── rag/
│   │       ├── chunker.py       RecursiveCharacterTextSplitter (500/50)
│   │       ├── vector_store.py  Pinecone + OpenAI embeddings
│   │       ├── generator.py     Claude prompt + RAG chain
│   │       └── loaders/
│   │           ├── webpage_loader.py   Single URL
│   │           ├── website_loader.py   Recursive crawler
│   │           ├── text_loader.py      Pasted text
│   │           └── faq_loader.py       Q&A pairs
│   ├── requirements.txt
│   ├── nixpacks.toml            Railway build config (Chromium)
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx              Routes + auth guard
    │   ├── api.js               Axios client + JWT helpers
    │   └── components/
    │       ├── ChatWindow.jsx   Student chat UI
    │       ├── QuickAccess.jsx  Sidebar with portal links
    │       ├── ResponseCard.jsx Answer card with source links
    │       ├── AdminPanel.jsx   Knowledge base manager
    │       ├── AdminLogin.jsx   Login modal
    │       ├── ThemeToggle.jsx  Dark / light switch
    │       └── Preloader.jsx    Startup animation
    ├── vercel.json              SPA rewrite rule
    └── package.json
```

---

## Running Locally

### 1. Backend

```bash
cd backend

# Windows
python -m venv venv && venv\Scripts\activate
# Mac/Linux
python -m venv venv && source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env   # then fill in your keys
```

Required `.env` values:

| Key | Source |
|-----|--------|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `OPENAI_API_KEY` | platform.openai.com |
| `PINECONE_API_KEY` | app.pinecone.io |
| `PINECONE_INDEX_NAME` | your index name (default: `uitm-chatbot-index`) |
| `SUPABASE_URL` | supabase.com project settings |
| `SUPABASE_KEY` | service role key |
| `SUPABASE_BUCKET` | storage bucket name (default: `knowledge-base`) |
| `JWT_SECRET` | run `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | choose your own |

First-time Pinecone setup — create an index with:
- Dimensions: `1536`, Metric: `cosine`, Cloud: AWS `us-east-1`

```bash
uvicorn app.main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Set `VITE_API_URL=http://localhost:8000` in `frontend/.env` if the default doesn't match.

---

## Deployment

### Backend → Railway

1. Push the `backend/` folder (or the whole repo) to a Railway service.
2. Railway auto-detects `nixpacks.toml` and installs Chromium + ChromeDriver for Selenium.
3. Add all `.env` keys as Railway environment variables, plus `APP_ENV=production` and `ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`.
4. Railway exposes a public HTTPS URL — copy it for the frontend.

### Frontend → Vercel

1. Import the repo into Vercel; set the root directory to `frontend`.
2. Add `VITE_API_URL=https://your-railway-backend.up.railway.app` as an environment variable.
3. `vercel.json` already handles SPA routing — no extra config needed.
4. Deploy. Vercel builds with `npm run build` automatically.

---

## How It Works

**Ingestion (admin panel):**
1. Admin adds a source — website crawl, single URL, document upload, pasted text, or Q&A pairs.
2. The loader extracts clean text with source metadata.
3. Text is split into 500-char chunks (50-char overlap) and embedded with OpenAI.
4. Vectors are stored in Pinecone.

**Query (chat):**
1. Student sends a question.
2. Query is embedded with the same model.
3. Pinecone returns the top-4 most similar chunks.
4. Claude receives the question + chunks and returns a step-by-step answer.
5. The response card displays the answer with clickable source links.

---

## License

Final Year Project — Universiti Teknologi MARA (UiTM) Samarahan, CSP600 / CSP650.
