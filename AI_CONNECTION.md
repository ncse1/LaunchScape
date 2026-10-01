# LaunchScape AI connection

The campaign builder calls a private server endpoint, which calls the OpenAI Responses API. The OpenAI key must never be put in app.js, browser storage, or GitHub.

## Server setup

This repository includes a Vercel-compatible function at `/api/campaign`. Deploy the repository to a Node-capable host and set these server environment variables privately:

- `OPENAI_API_KEY`: the project key.
- `LAUNCHSCAPE_ACCESS_TOKEN`: a long random office access code (at least 32 characters).
- `ALLOWED_ORIGINS`: `https://ncse1.github.io` plus the exact HTTPS origin of the hosted app if used there.
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`.

On the GitHub Pages app, open Settings, enter the deployed server URL ending in `/api/campaign`, and enter the office access code. Campaign drafts remain in the current browser; download them for a portable copy. Requests send campaign briefs, not saved lead records. This does not search MLS or send outreach.

GitHub Pages cannot run this function. Creating an API key does not deploy a server. Host billing/plan eligibility and OpenAI billing must be checked before going live. A dedicated OpenAI project budget and host-level rate limits are recommended for ongoing use. The office code protects access to billable calls; CORS only limits browser origins.

## Local verification

Use Node 22 or newer. Copy `.env.example` to `.env.local` and configure privately. Run `npm test`, then `npm start`. The local server serves only four named public files; env files cannot be downloaded. Allow `http://localhost:3000` in `ALLOWED_ORIGINS` for local browser use.

The test suite uses a simulated AI provider. A passing suite does not confirm account quota, model access, or deployed hosting.
