# LaunchScape working rules

- Keep the estimating flow in `ncs-iphone-estimator-sandbox/`. Preserve unrelated marketing and real-estate features.
- Plan the customer flow, implement it, run calculation tests, then verify the browser flow before claiming completion.
- Never invent material costs, quantities, crew hours, electrical conditions or code compliance from photos. Missing entries must block proposal preview.
- Default estimating rates: two-person service selling rate $225/hour, direct crew cost $70/hour, material markup 40%, overhead allowance 20% of sales. All must be editable. Emergency selling rate $300/hour is a separate choice, not the default. These are starting assumptions to confirm for each job.
- Calculate totals deterministically. Explain markup versus margin. Deduct the overhead allowance from profit for reporting; do not silently add it to the customer price.
- Scope checkboxes describe inclusions and must not duplicate base charges. Additional work requires explicit separate lines.
- Exclude internal costs, markup, overhead and profit from customer printouts.
- Keep provider credentials server-side. Do not connect AI, upload photos or claim AI interpretation without an implemented, tested connection and explicit data handling.
- Local drafts are device/browser specific. Do not describe them as cloud backups. Preserve old demo storage separately from real estimates.
- Run `npm test`, `node --check server.mjs`, and a browser flow covering photo selection, dependent dropdowns, incomplete pricing, totals, save/reopen and print output.
- Keep `pricing.js` and its embedded copy in estimator HTML identical (asserted in tests).
- Distinguish local verification, repository save, deployment status and live verification in completion reports.
