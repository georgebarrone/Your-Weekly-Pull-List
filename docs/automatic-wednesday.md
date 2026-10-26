# Automatic Wednesday delivery (Windows)

The Windows-side runner uses the existing subscriptions in Turso, finds eligible issues in the Wednesday-to-Tuesday release window, drives the signed-in browser's normal PDF download controls, and emails each completed PDF to your own Gmail inbox. Only successful attachment emails are marked delivered in Turso. It does not bypass login checks, challenges, account limits, download restrictions, or site permissions.

**Status:** implementation committed; the end-to-end download flow must still be verified against the website using your signed-in account on your PC. The site generates files in JavaScript, and native folder dialogs may prevent unattended browser automation.

## First-time setup

1. On your Windows PC, open PowerShell in the repository and run:

   ```powershell
   git pull
   npm install
   npx playwright install firefox
   ```

2. Copy `.env.example` to `.env` if you haven't already, and configure these values **locally** (never post passwords or auth tokens in chat/GitHub):

   ```dotenv
   TURSO_DATABASE_URL=libsql://your-existing-database.turso.io
   TURSO_AUTH_TOKEN=your-existing-database-token
   SMTP_USER=your-sending-gmail@gmail.com
   SMTP_APP_PASSWORD=your-gmail-app-password
   EMAIL_TO=your-own-receiving-email@example.com
   REQUIRE_PDF_ATTACHMENTS=true
   ```

   The **same Turso database** must be used by Render and this Windows job. You do not need to run the older `pdf-watch` script.

3. Run `npm run pdf-login`. Firefox opens with a separate, persistent local profile. Sign in using the website itself, then press Enter in the terminal. Don't paste credentials or session cookies into any terminal or repository files.

4. Preview the issues without emailing or downloading anything:

   ```powershell
   npm run pdf-weekly -- --dry-run
   ```

5. Test just one pending issue (real PDF + real email):

   ```powershell
   npm run pdf-weekly -- --test-one
   ```

   If the site uses a native directory picker instead of browser download events, this step may fail rather than saving the PDF. Do not schedule unattended runs before this works.

6. Once the one-issue test passes, install the automatic Wednesday task:

   ```powershell
   .\scripts\register-weekly-task.ps1
   ```

   This creates a per-user Windows Task Scheduler task for **Wednesday at 1:35 PM in your PC's local time zone**. Set Windows to the Pacific time zone, leave the PC powered on, and stay signed in to your Windows account. If your website session expires, repeat `npm run pdf-login`.

## Behavior and safeguards

- The local job only considers **subscribed issues** dated within the current Wednesday-to-Tuesday window that are not already marked delivered.
- It currently supports an issue only when its reader URL matches the newest chapter on the series page. When a title gets multiple new chapters, or metadata is ambiguous, the job skips rather than sending the wrong material.
- Only PDF files with a valid PDF header, under 17 MB, are emailed. Each issue is emailed separately, so oversized PDFs are reported rather than split or silently replaced with links.
- Browser profiles and downloaded files are stored in ignored local `data/` folders, not in GitHub or Render.
- GitHub Actions is **metadata-preview only**. It no longer sends link-only digests or marks issues delivered. The Windows task handles actual attachments and delivery tracking.
- The job doesn't bypass CAPTCHA, account-age rules, rate limits, purchase requirements, or native browser file permissions. Downloading is limited to material you're authorized to copy and email.
- When an issue fails, it remains pending. Read the script's error output and run `npm run pdf-weekly` to retry while the issue is in the current release window.

## Important limitations

The site currently describes browser-side PDF generation, and its exact modal selectors have not been validated in a signed-in session. This is a guarded first implementation, **not a confirmed unattended integration**. If `--test-one` fails, the UI automation needs adjustment based on a non-sensitive screenshot or a sanitized error message. Avoid sending your login credentials, cookies, or session files.

If your PC is off, Windows can't do the download. Windows Task Scheduler's start-when-available setting can trigger on the next available opportunity, but this is not a guarantee of delivery at exactly 1:35 PM.
