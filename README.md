# Your Weekly Pull List

A private, mobile-friendly comic series subscription manager with a Wednesday email digest.

## What's built

- PIN-protected dashboard with mobile styling, multiple tabs, search, subscription add/remove, and delivery history.
- Discover current weekly issue listings from the **public** BatCave new-comics page; add subscriptions using a BatCave series URL.
- Automatic email of the latest **catalogued** issue when a subscription is added, if Gmail is configured.
- Manual issue entry and “Email now” for titles/older issues missing from the weekly feed.
- Turso-backed subscriptions, issue catalog, emailed-issue deduplication, and weekly-run tracking.
- GitHub Actions Wednesday job, targeted for **1:35 p.m. America/Los_Angeles**, using two cron expressions and a daylight-saving-aware guard.
- Attractive HTML emails with series names, issue numbers, release dates, reading links, and optional PDF attachments **only from domains explicitly authorized by the operator**.

## What's not assumed or built

**BatCave public listing dates are not independently verified official publisher release dates.** The site calls its page “New Comics This Week” and groups titles by publisher, but that does not establish authoritative publication metadata. Future-dated entries are excluded from the Wednesday send. The catalog parser may require maintenance if the site's HTML changes.

**No scraping, downloading, conversion, or emailing of comic book interiors from BatCave is implemented.** The reader is JavaScript-dependent and its content-sharing permissions are unverified. PDF emailing is supported only for a separately specified, permissioned HTTPS host, and is not enabled by default. If there's no authorized attachment, the digest contains reading links instead. Do not upload copyrighted comic PDFs or credentials to the repository.

**“Email latest immediately” works only if that issue is already indexed in the public weekly catalog and its listed date has arrived.** To deliver another known issue, enter it under “Add a known issue” with its issue-reader link and release date. A future provider integration could populate historical issues automatically.

## Local setup

1. Install Node.js 22+ and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Create a strong unique random `SESSION_SECRET` of at least 32 characters.
4. Generate your PIN hash with `npm run pin -- 123456` (choose a private PIN; 6+ digits recommended). Copy the resulting `PIN_HASH=` value into `.env`. Never commit `.env`.
5. For local testing, leave `TURSO_DATABASE_URL` unset; the app creates `data/pull-list.db`. For Render, a remote Turso database is **required**.
6. Run `npm start`, then open `http://localhost:3000`.
7. After signing in, click **Check for releases** to import the public weekly index. Choose a catalog issue to subscribe or paste a series URL.

### Test

`npm test` covers PIN/session handling, schedule date ranges, series URL safety, and an HTML parser fixture. The parser fixture resembles the site's publicly observed listing but needs live deployment verification.

### Email configuration (later)

The existing Gmail account can be reused. Put the sender's address in `SMTP_USER`, its Gmail app password in `SMTP_APP_PASSWORD`, and your recipient email in `EMAIL_TO`. Do this in Render environment variables **and** GitHub Actions secrets; the two services run independently. Don't share passwords in chat or source control. Gmail limits attachment size (normally ~25 MB for a message), so attachments are capped around 18 MB total here; links remain available.

### Authorized PDF attachments (optional)

Set `AUTHORIZED_PDF_HOSTS=files.your-own-domain.example` for an HTTPS hostname you control or have explicit permission to distribute files from. For a known catalog issue, the protected API endpoint `POST /api/issues/:id/authorized-pdf` accepts `{ "url": "https://files.your-own-domain.example/issue.pdf" }`. File contents must start with a `%PDF-` header and fit the attachment cap. Unapproved domains, redirects and non-PDF content are rejected/ignored. A future UI can manage this after a legitimate source is set up.

## Turso + Render

1. Create an empty Turso database and read/write auth token.
2. Push the code to a **separate** GitHub repository named `Your-Weekly-Pull-List`.
3. Connect that repository to a Render **Web Service** using `render.yaml` or manually use `npm install` / `npm start`.
4. In Render, set `PIN_HASH`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a securely generated `SESSION_SECRET`. Optionally configure SMTP now or later.
5. On GitHub Actions secrets, set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_TO` (and optional `AUTHORIZED_PDF_HOSTS`).
6. Test using **Actions → Your Weekly Pull List → Run workflow** with `dry_run: true` first. This previews without emailing or marking deliveries; running manually with dry_run false sends eligible issues.

The dashboard and workflow must share the **same Turso database** so subscriptions and delivery history stay in sync. The cron uses 20:35 and 21:35 UTC because Pacific time changes with DST; the Node script checks local Pacific time to select the appropriate run and tolerates delayed starts. GitHub Actions schedules can start late, so delivery is *targeted*, not guaranteed to the minute.

### Operational notes

- The current feed contains comics from the website's public “new this week” page, not the entire archival catalogue. Search finds indexed entries only.
- History persists when a series is unsubscribed. A previously delivered issue is not re-emailed automatically on resubscribe.
- Wednesday once per week; no automatic Thursday catch-up. Manual dashboard refresh is available at any time.
- Don't enable public access to your dashboard without a secure PIN. In production, use HTTPS via Render.
- Free-tier resource limits, Render sleep behavior, and third-party pricing/policies may change.
- Site changes, rate limits and connectivity failures can stop an import. The automated job fails visibly and is retryable.

## Directory layout

- `src/server.js` — API and PIN-protected dashboard
- `src/db.js` — Turso/libSQL persistence
- `src/batcave.js` — public issue **metadata** parser
- `src/mailer.js` — email digest and optional authorized-PDF attachments
- `src/runner.js` — weekly collector with duplicate tracking
- `scripts/weekly.js` — DST-aware automation entrypoint
- `public/` — responsive dashboard frontend
- `.github/workflows/wednesday.yml` — GitHub Actions job
