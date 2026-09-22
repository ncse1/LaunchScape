# LaunchScape — The Outside Company

Private internal lead-generation cockpit for Southwest Florida property prospecting.

## What works in this starter
- Live Lee County parcel search using the public ArcGIS parcel service
- Cape Coral / Lee County filters
- Target profiles: Waterfront Paradise, Pool Upgrade, New Owner, Premium Home, Older Home Refresh, Snowbird / Out-of-State Owner
- 0–100 lead scoring with plain-English score reasons
- Save prospects into a pipeline
- Michael Schwartz assignment
- Today's Work / hot-lead queue
- Follow-up dates and quick call outcomes
- Contact enrichment fields for manually verified phone/email
- Campaign creation and bulk assignment
- CSV export
- Local browser persistence so it works before a database is connected
- Supabase schema included for the next step

## Run
This is a static app. Open `index.html` locally, or deploy the folder to Vercel / Netlify / another static host.

## Database
The current app uses browser localStorage so it works immediately.
`supabase/schema.sql` contains the initial database schema for moving persistence to Supabase.

## Data source
Lee County Property Appraiser / Lee County Government ArcGIS parcel layer:
https://gismapserver.leegov.com/gisserver910/rest/services/Layers/ParcelAddress/MapServer/0
