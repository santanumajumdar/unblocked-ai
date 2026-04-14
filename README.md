# Unblocked AI

**AI-powered status intelligence for Technical Program & Project Managers**

> Built for TPMs who spend 4–8 hours a week writing the same update five different ways. Unblocked AI generates role-aware program status updates — for execs, engineers, PMs, and steering committees — in seconds.

**Free forever. No credit card. No paywall.**

---

## Features

- **Role-aware generation** — One set of program signals, four audience-tuned narratives (Exec BLUF, PM narrative, Engineering deep-dive, Steering committee brief)
- **Real-time AI** — Powered by Claude API with live streaming typewriter output
- **Program portfolio** — Track up to 10 programs with RAG status, milestones, and update history
- **Risk Radar** — AI-detected signals: velocity drops, unresolved blockers, overdue milestones
- **Update history** — Searchable log of all generated updates with one-click reuse
- **Zero backend** — Pure frontend, runs entirely in the browser, API key stored locally

---

## Quick Start

### Option 1 — Open directly in browser
```bash
# Clone the repo
git clone https://github.com/your-username/unblocked-ai.git
cd unblocked-ai

# Open index.html in your browser
open index.html
```

When prompted, enter your Anthropic API key. It is stored only in your browser's `localStorage` — never sent anywhere except directly to Anthropic's API.

### Option 2 — Serve locally
```bash
# Using Python
python3 -m http.server 3000

# Using Node
npx serve .

# Then open http://localhost:3000
```

### Option 3 — Deploy to Netlify / Vercel / GitHub Pages
Just push to a repo and deploy the root directory. No build step required.

---

## Getting an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and generate an API key
3. Paste it into the Unblocked AI settings screen on first launch

The key is stored in `localStorage` and never leaves your browser except in direct calls to `api.anthropic.com`.

---

## Project Structure

```
unblocked-ai/
├── index.html          # Main app entry point
├── css/
│   └── styles.css      # All styles (design system + components)
├── js/
│   ├── app.js          # App router, state management, page logic
│   ├── api.js          # Claude API integration (real-time generation)
│   ├── programs.js     # Program CRUD + localStorage persistence
│   └── ui.js           # UI helpers (toasts, toggles, animations)
├── README.md
└── .gitignore
```

---

## Tech Stack

- **Vanilla HTML/CSS/JS** — Zero dependencies, zero build tooling
- **Claude API** (`claude-haiku-4-5`) — Fast, cost-effective generation
- **localStorage** — All data persists in the browser
- **Google Fonts** — DM Sans + Fraunces

---

## Roadmap

- [ ] Jira integration (auto-pull sprint data)
- [ ] Slack direct publish
- [ ] Team workspaces
- [ ] Export to PDF / DOCX

---

## License

MIT — free to use, fork, and deploy.

---

*Built by Santanu Majumdar — L6 Sr. TPM | Author of [Unblocked Newsletter](https://linkedin.com/in/santanumajumdar)*
