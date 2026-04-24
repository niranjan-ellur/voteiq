# VoteIQ — Your Election Intelligence Assistant

A smart, role-aware election assistant that guides voters, candidates, and election officials through every step of the Indian election process — powered by Google AI.

## Chosen Vertical

**Civic Engagement / Election Process Assistant** — helping citizens, candidates, and officials navigate the complex Indian election system with ease, in their own language.

## Approach and Logic

### Role-Based Intelligence
The core innovation is **persona-aware AI**. Before any interaction, the user selects their role:

| Role | Focus |
|------|-------|
| 🧑‍💼 Voter | Registration, polling booth, ID requirements, voting day |
| 🏛️ Candidate | Nomination filing, MCC rules, expenditure limits, deadlines |
| ⚖️ Election Official | EVM handling, duties checklist, polling protocols, counting day |

Each persona loads a distinct Gemini system prompt, tailored suggestions, and a role-specific checklist — the assistant becomes a different expert depending on who's asking.

### Decision Flow
```
User selects persona → Role-specific context loaded → Question sent to Gemini AI →
Response optionally translated via Google Cloud Translation API →
User sees: AI Chat + Election Timeline + Step-by-step Checklist
```

## How the Solution Works

1. **Persona Selection** — Landing screen with 3 interactive role cards
2. **AI Chat** — Powered by Gemini 2.5 Flash, maintains conversation history, response caching (5 min TTL)
3. **Multilingual Responses** — Google Cloud Translation API translates AI responses into 11 Indian/global languages in real time
4. **Election Timeline** — Visual 8-phase timeline of the Indian election process with status indicators
5. **Role Checklist** — Interactive checklist tailored to each persona with ARIA accessibility
6. **Security** — Rate limiting (20 req/min), input sanitization, CSP/XSS headers, path traversal prevention
7. **Tested** — 17+ automated tests covering security, caching, API validation, and HTTP behaviour

## Google Services Used

| Service | How it's used |
|---------|--------------|
| **Gemini 2.5 Flash** | Powers all AI chat responses with role-specific system prompts |
| **Google Cloud Translation API** | Translates AI responses into Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu |
| **Google Cloud Run** | Hosts the containerised Node.js application |
| **Google Fonts** | Inter typeface for clean, readable UI |

## Assumptions

- Gemini API key is set as `GEMINI_API_KEY` environment variable (same key works for Translation API)
- Election context is the **Indian General Election** (Lok Sabha / State Assembly)
- Timeline phases are illustrative of the standard ECI election schedule
- Translation API uses the same GCP project key — enable "Cloud Translation API" in your GCP console

## How to Run Locally

```bash
# 1. Set your API key in .env
echo "GEMINI_API_KEY=your_key_here" > .env

# 2. Install dependencies
npm install

# 3. Run
npm run dev
```

Open `http://localhost:8080`

## How to Run Tests

```bash
npm test
```

## How to Deploy on Cloud Run

```bash
gcloud run deploy voteiq \
  --project voteiq-494318 \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

## Project Structure

```
election/
├── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html          # Accessible app shell with ARIA roles
│   ├── app.js              # UI logic, chat, timeline, checklist, language
│   └── style.css           # Dark theme, responsive, focus styles
├── src/                    # Backend modules
│   ├── config.js           # Centralised configuration
│   ├── security.js         # Rate limiting, sanitization, security headers
│   ├── cache.js            # LRU response cache (5 min TTL)
│   ├── gemini.js           # Gemini API client with system prompts
│   ├── translate.js        # Google Cloud Translation API client
│   └── router.js           # Request routing and validation
├── tests/                  # Automated test suite
│   ├── security.test.js    # Input sanitization and validation tests
│   ├── cache.test.js       # Cache behaviour tests
│   └── server.test.js      # HTTP integration tests
├── server.js               # Entry point, static serving, security headers
├── package.json
├── Dockerfile              # Cloud Run container (node:20-alpine)
└── README.md
```
