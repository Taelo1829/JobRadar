# Job Radar

The app owns its backend schedule. It does not use ChatGPT Tasks or a browser timer to search for jobs.

Production: https://job-radar.taelo-jobradar.workers.dev . Username: `owner`. The generated private password is stored in the ignored local `.env.local` file and the Cloudflare `APP_PASSWORD` secret. It is not committed. The older chatgpt.site deployment is a preview and has no active scheduler.

## Cloudflare deployment

1. Authenticate with `npx wrangler login`.
2. Create the production database with `npx wrangler d1 create job-radar`. Retain the returned database UUID. Do not recreate it on subsequent deployments.
3. Build with `npm run build`, then run `node scripts/prepare-cloudflare.mjs <database-uuid>`.
4. Apply migrations with `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.standalone.json`.
5. Configure `APP_PASSWORD` with `npx wrangler secret put APP_PASSWORD --config dist/server/wrangler.standalone.json`. Use a long unique password. Enter it only at the secure prompt. The app fails closed until this exists. Browser username is `owner`.
6. Configure `BRAVE_SEARCH_API_KEY` similarly for company-name searches. It is optional only when every search has a direct supported career-board URL. Do not commit secrets or put them in command arguments.
7. Deploy with `npx wrangler deploy --config dist/server/wrangler.standalone.json`.

The generated Cloudflare configuration registers `0 6,11,18 * * *` in UTC, corresponding to 08:00, 13:00 and 20:00 Africa/Johannesburg year-round. The Worker's scheduled handler calls the same server-side scanner as Check now. It works when the browser and computer are closed. Trigger propagation can take several minutes. Inspect trigger registration and the persisted `schedulerLastRun` before claiming scheduled execution has been verified.

All assets and APIs require the app password on standalone Cloudflare. The Sites preview instead uses its existing owner-private ChatGPT sign-in boundary. Do not widen the Sites audience without adding per-user storage and authorization. Its host does not activate the standalone cron automatically.

## Searches and notifications

- Automatic sources: PNet and CareerJunction public search pages, with up to six detail pages per source per search. Employer/title matching and expiry checks precede import. Source status reports partial coverage and failures.
- JSearch: configure JSEARCH_API_KEY in Cloudflare with `node scripts/provision-jsearch.mjs`. This reads JSEARCH_API_KEY (or JSearch_API_KEY) from ignored .env.local and sends it via stdin to Wrangler. Indexed listings from LinkedIn, Indeed and other publishers are imported automatically with strict employer/title filtering. One page per watch per scan limits usage (about 90 requests per watch per 30 days, plus manual checks). Index coverage varies and is not a direct exhaustive scan of each publisher. Quota/authentication failures appear in source status. Secrets stay on the server.

- Direct boards: Greenhouse, Lever and Ashby public APIs. Titles must include every word of the requested role.
- General discovery: Brave Search discovers pages; only JobPosting structured data whose employer matches the requested company is imported. Expired structured postings are excluded. Search coverage is limited by indexing and employer markup. Provider and page failures are surfaced rather than treated as confirmed zero vacancies.
- Jobs are deduplicated by company and canonical source URL. Applied and dismissed records remain stored to avoid repeat notifications. Applied Posts shows the trailing 14 days using application time, not posting time.
- Web Push requires the user's browser permission on each device. The server stores subscriptions and a generated VAPID key pair in D1. It sends an authenticated empty push; the service worker fetches the current message with a generic fallback if the private session expired. Browser/OS support and permissions affect delivery.
- Applied tracks an application; it does not submit one.

## Verification

`npx tsc --noEmit` checks types; `npm run build` creates the Worker. `node scripts/test-search.mjs` tests employer/title matching, expiry and structured-data parsing. `scripts/test-local.mjs` tests the preview API against a local QA Test Company watch only. No sample listings are created in production.

For local cron verification, run `node scripts/test-cron.mjs` after building. It starts an isolated Miniflare runtime with an in-memory database, invokes the compiled scheduled handler and verifies the persisted completion marker. Production cron registration is shown by Wrangler deploy; it can take up to 15 minutes to propagate.

Creating a saved search runs its initial scan in the save API before returning. The UI opens Job Posts, clears filters and displays progress; subsequent scans use the existing SAST cron.
