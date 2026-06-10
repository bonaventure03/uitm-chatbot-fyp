# UiTM Campus Assistant Chatbot

A web-based RAG (Retrieval-Augmented Generation) chatbot that serves as a one-stop conversational layer over UiTM's fragmented digital portals — providing step-by-step navigation guides and portal links in response to student queries.

Built to match the architecture defined in **CSP600 Report (Bonaventure Tindin, CDCS2303A)** — see report Figures 3.5, 3.7, 3.10, 3.11 and Tables 3.2, 3.5.

## Tech Stack

| Layer | Tool |
|-------|------|
| LLM (answer generation) | **Anthropic Claude Sonnet 4.5** |
| Embeddings | **OpenAI `text-embedding-3-small`** (1536 dims) |
| Vector Database | **Pinecone** (serverless, cosine similarity) |
| Orchestration | **LangChain** |
| Backend | **FastAPI** + Uvicorn |
| Frontend | **React 18 + Vite + Tailwind CSS** |
| Scraping | BeautifulSoup, requests, Selenium |
| Document parsing | pdfplumber, python-docx |

## Project Structure

```
uitm-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py                  FastAPI entry
│   │   ├── config.py                Loads .env
│   │   ├── api/
│   │   │   ├── chat.py              POST /api/chat
│   │   │   └── admin.py             Data source management
│   │   └── rag/
│   │       ├── chunker.py           Text splitter
│   │       ├── vector_store.py      Pinecone + embeddings
│   │       ├── generator.py         Claude + RAG prompt
│   │       └── loaders/
│   │           ├── webpage_loader.py    Single URL
│   │           ├── website_loader.py    Recursive crawler
│   │           ├── document_loader.py   PDF / DOCX / TXT
│   │           ├── text_loader.py       Pasted content
│   │           └── faq_loader.py        Q&A pairs
│   ├── seed_uitm.py                 One-time seed for UiTM portals
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── components/
    │       ├── ChatWindow.jsx       Student chat UI
    │       ├── QuickAccess.jsx      Portal sidebar
    │       ├── ResponseCard.jsx     Answer card with source link
    │       └── AdminPanel.jsx       Knowledge base manager
    ├── package.json
    └── tailwind.config.js
```

---

## Setup

### 1. Backend

```bash
cd backend

# Activate your venv (you already created it)
# Windows:  venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and paste your real API keys
```

Your `.env` must contain:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `OPENAI_API_KEY` — from platform.openai.com (for embeddings)
- `PINECONE_API_KEY` — from app.pinecone.io
- `PINECONE_INDEX_NAME` — must match the index you created (default: `uitm-chatbot-index`)

### 2. Create the Pinecone Index (one-time)

On app.pinecone.io, create an index with:
- **Name:** `uitm-chatbot-index`
- **Dimensions:** `1536` (must match OpenAI's text-embedding-3-small)
- **Metric:** `cosine`
- **Cloud:** AWS, region `us-east-1`

Alternatively, the app will auto-create it on first run.

### 3. Seed with UiTM Public Portals

```bash
python seed_uitm.py
```

This ingests the eight public portals from your report's Table 3.2 (UiTM main site, iStudent landing, Convocation, Academic Calendar, Bendahari, HEP, FAQ SSO, PTAR).

### 4. Start the Backend

```bash
uvicorn app.main:app --reload --port 8000
```

API docs will be at http://localhost:8000/docs

### 5. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## How It Works

**Ingestion Pipeline (offline):**
1. Admin adds a data source via the admin panel (website, webpage, document, text, or FAQ)
2. The loader extracts clean text and attaches source metadata
3. `RecursiveCharacterTextSplitter` splits text into 500-char chunks with 50-char overlap (per report Figure 3.11)
4. OpenAI embeds each chunk into 1536-dim vectors
5. Pinecone stores them with full metadata

**Query Pipeline (online):**
1. Student types a question
2. Query is embedded with the same model
3. Pinecone returns top-4 most similar chunks (cosine similarity)
4. Claude receives the question + retrieved chunks in a carefully-designed prompt
5. Claude generates a **step-by-step answer** with natural, varied phrasing (`temperature=0.7`)
6. Response card shows the answer + portal links for each source

**Why responses are "not fixed":** Claude's temperature of 0.7 produces different wording each time while the system prompt constrains the *structure* (intro → numbered steps → dates → source link). This gives structural consistency with linguistic variety — exactly what NLP-driven generation provides.

---

## Adding Data Sources (chatling.ai-style)

Click the ⚙️ button in the bottom-right of the chat to open the admin panel. Choose a tab:

- **Website** — Crawls an entire site (e.g., all of bendahari.uitm.edu.my up to 20 pages)
- **Webpage** — A single URL (e.g., HEP dress code page)
- **Document** — Upload a PDF, DOCX, or TXT — used for password-protected portals where documents are exported manually
- **Text** — Paste custom content (announcements, summaries)
- **FAQ** — Q&A pairs, each indexed individually for precise matching

---

## Troubleshooting

**"Missing API keys" on startup** — Check `.env`. Keys must not contain placeholder text like `your-key-here`.

**Pinecone index dimension mismatch** — Make sure your index has dimension 1536 to match `text-embedding-3-small`.

**Crawler returns 0 pages** — The UiTM site may use `robots.txt` or rate-limiting. Try the single-webpage loader instead for specific URLs, or add Selenium for JavaScript-heavy pages.

**Claude refuses to answer** — Good! It means the retrieval returned nothing relevant. Add more data sources in the admin panel, or rephrase the question.

---

## Report References

- **Architecture:** Figure 3.5 (RAG-based system architecture)
- **Query Flow:** Figure 3.6 (System flowchart) + Figure 2.3 (NLP-RAG pipeline)
- **UI Mockup:** Figure 3.7 (UiTM Campus Assistant chatbot)
- **Chunking & Embedding:** Figure 3.10, 3.11
- **Target Portals:** Table 3.2
- **Software Stack:** Table 3.5

---

## License

Final Year Project — Universiti Teknologi MARA (UiTM) Samarahan, CSP600 / CSP650.
