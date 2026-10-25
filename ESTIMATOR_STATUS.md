# Field estimator update — October 25, 2026

The existing estimator now uses editable NCS service assumptions instead of synthetic package prices. Materials and crew hours must be entered per job. Scope selections are inclusions, not extra charges. Additional work is entered explicitly. Internal costs and profit are excluded from the customer proposal.

Defaults: two-person selling rate $225/hour, direct crew cost $70/hour, materials markup 40%, overhead allowance 20% of sales. These assumptions are visible and editable. Overhead is deducted for internal reporting, not added again to the selling price. Cost inputs should include applicable labor burden; fees and other charges must be entered explicitly.

Example: $500 materials, four crew hours → $1,600 selling price, $780 direct cost, $820 gross profit, $320 overhead allowance, $500 after overhead allowance. This is a calculation example, not a job quotation.

Fixed the local server syntax error and estimator route. Start with `npm start`; open `/ncs-iphone-estimator-sandbox/`. LaunchScape home now links to the estimator.

## Verification

- `npm test`: 11 tests passed, including original campaign checks and estimator calculations/validation.
- `node --check server.mjs`: passed.
- Embedded estimator scripts: syntax checks passed.
- Server startup: confirmed.
- Full browser verification: NOT completed. Chromium was absent; browser download returned an invalid archive. `scripts/verify-estimator.cjs` is prepared for execution with Playwright and Chromium installed, while `npm start` is running: `node scripts/verify-estimator.cjs`.
- Native iPhone camera and print behavior: NOT field-tested.
- Deployment/live behavior: NOT verified by this update.

## Still outstanding

AI photo interpretation is not connected. Photos currently document the job locally. A server-side provider connection and verification are still required before claiming photo-to-scope automation. Drafts/photos are saved only on the device/browser, not synced or backed up. Old synthetic demo drafts remain under their old storage key and are not treated as valid estimates.
