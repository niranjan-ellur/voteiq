# VoteIQ — Your Election Intelligence Assistant

A smart, role-aware election assistant that guides voters, candidates, and election officials through every step of the Indian election process — powered by Google AI and Firebase.

## Chosen Vertical

**Civic Engagement / Election Process Assistant** — helping citizens, candidates, and officials navigate the complex Indian election system with ease, in their own language, with persistent personalized history.

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
User signs in with Google → Selects persona → Role-specific AI context loaded →
Question sent to Gemini 2.5 Flash → Response translated via Google Cloud Translation API →
Chat saved to Firestore → Analytics event tracked → User sees response
```

## Features

1. **Google Sign-In (Firebase Auth)** — Secure authentication, chat history tied to user account
2. **AI Chat (Gemini 2.5 Flash)** — Role-aware responses with conversation history, response caching (5 min TTL)
3. **Persistent Chat History (Firestore)** — Conversations saved per user per persona, reloaded on next visit
4. **Multilingual Responses (Cloud Translation API)** — AI responses translated into 11 Indian/global languages in real time
5. **Election Timeline** — Visual 8-phase timeline with status indicators (done/active/upcoming)
6. **Role Checklist** — Interactive step-by-step checklist tailored to each persona
7. **Polling Booth Finder (Google Maps)** — Search any city to find election offices and polling stations
8. **Election Stats Dashboard (Google Charts)** — 4 live charts with real 2024 Indian election data
9. **Google Analytics** — Tracks persona selections, questions asked, tab views

## Google Services Used

| Service | How it's used |
|---------|--------------|
| **Gemini 2.5 Flash** | Powers all AI chat with role-specific system prompts and conversation history |
| **Firebase Authentication** | Google Sign-In — secure user identity |
| **Cloud Firestore** | Persists chat history per user per persona |
| **Google Analytics (Firebase)** | Tracks user events: persona selection, questions, tab views |
| **Cloud Translation API** | Translates AI responses into 11 languages server-side |
| **Google Maps Embed** | Polling booth and election office finder by city |
| **Google Charts** | Election statistics: seat distribution, turnout trends, voter growth, women candidates |
| **Google Cloud Run** | Hosts the containerised Node.js application |
| **Google Fonts** | Inter typeface for clean, accessible typography |

## Security

- Rate limiting (20 requests/minute per IP)
- Input sanitization (XSS prevention, length limits)
- Security headers (CSP, X-Frame-Options, X-XSS-Protection, nosniff, Referrer-Policy)
- Path traversal prevention (`path.resolve()` with strict prefix check)
- CORS restricted to the deployed Cloud Run origin
- **Firebase Admin SDK server-side** — Firestore reads/writes happen on the server; the client never touches Firestore directly. ID tokens are verified server-side via `admin.auth().verifyIdToken()`
- Firestore Security Rules — defence-in-depth: users can only read/write their own chat data
- All API keys and service account credentials stored as server-side environment variables only — nothing secret appears in client code

## Assumptions

- `GEMINI_API_KEY` from Google AI Studio powers Gemini chat
- `TRANSLATE_API_KEY` from GCP Console powers Cloud Translation API (same project `voteiq-494318`)
- Election context is the **Indian General Election** (Lok Sabha / State Assembly)
- Timeline phases are illustrative of the standard ECI election schedule

## How to Run Locally

```bash
# 1. Set your API keys in .env
GEMINI_API_KEY=your_gemini_key
TRANSLATE_API_KEY=your_gcp_key
PORT=8080

# 2. Set Firebase Admin credentials in .env (from Firebase Console → Service Accounts)
FIREBASE_PROJECT_ID=voteiq-494318
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@voteiq-494318.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# 3. Install dependencies
npm install

# 4. Run dev server
npm run dev
```

Open `http://localhost:8080`

## How to Run Tests

```bash
npm test
```

Tests cover: input sanitization, payload validation, response caching, HTTP endpoints, security headers, path traversal prevention.

## How to Deploy on Cloud Run

```bash
gcloud run deploy voteiq \
  --project voteiq-494318 \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,TRANSLATE_API_KEY=your_key,FIREBASE_PROJECT_ID=voteiq-494318,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@voteiq-494318.iam.gserviceaccount.com,FIREBASE_PRIVATE_KEY=your_private_key,ALLOWED_ORIGIN=https://voteiq-<hash>-el.a.run.app"
```

## Project Structure

```
election/
├── public/                 # Frontend (served statically)
│   ├── index.html          # Accessible app shell with ARIA roles, skip links
│   ├── app.js              # UI logic: chat, timeline, checklist, maps, charts, auth
│   ├── firebase.js         # Firebase SDK: Auth, Firestore, Analytics
│   └── style.css           # Dark theme, responsive, focus styles, animations
├── src/                    # Backend modules
│   ├── config.js           # Centralised configuration
│   ├── security.js         # Rate limiting, input sanitization, security headers
│   ├── cache.js            # LRU response cache (5 min TTL, 100 entry limit)
│   ├── gemini.js           # Gemini 2.5 Flash API client with system prompts
│   ├── translate.js        # Google Cloud Translation API client
│   └── router.js           # Request routing, validation, translation orchestration
├── tests/                  # Automated test suite (Node built-in test runner)
│   ├── security.test.js    # Input sanitization and payload validation tests
│   ├── cache.test.js       # Cache behaviour and TTL tests
│   └── server.test.js      # HTTP integration tests (endpoints, headers, static serving)
├── server.js               # Entry point: HTTP server, static files, routing
├── firestore.rules         # Firestore security rules
├── .eslintrc.json          # ESLint configuration
├── package.json
├── Dockerfile              # Cloud Run container (node:20-alpine)
└── README.md
```
