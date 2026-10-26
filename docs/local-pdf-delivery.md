# Local PDF delivery

A standalone option for emailing **PDF files you are permitted to copy and send to yourself**. It does not interact with a reader website, automate sign-in, bypass download limits, or download files.

## Setup on Windows

1. Install Node.js 22+ and clone the repository. Open a terminal in the project directory and run `npm install`.
2. If you do not have a local `.env` file, copy `.env.example` to `.env`. Keep this file private.
3. Set `SMTP_USER` (your Gmail sender), `SMTP_APP_PASSWORD` (the sender's Gmail app password), and `EMAIL_TO` (your own recipient address). These values live **only on your PC**, not in GitHub.
4. Optionally set `PDF_INBOX_DIR=C:\\Users\\YOUR_USER\\Downloads\\WeeklyPullList` or leave it unset to use the same folder inside your Windows Downloads directory.
5. Run `npm run pdf-watch`, and keep that terminal open. The program checks the folder every 30 seconds. To check just once, run `npm run pdf-inbox`.
6. Save PDFs you are authorized to email in this **dedicated folder**. In browsers that offer a download-folder picker, select this folder. Avoid selecting your general Downloads folder.

Each PDF smaller than 17 MB is mailed individually to your configured address once. The script verifies the PDF header, avoids incomplete files, and records SHA-256 fingerprints in `data/local-pdf-sent.json` to prevent duplicate sends. An unavailable SMTP service does not mark a file as sent. A file larger than the limit is skipped with a warning.

**Important:** Files already in the inbox at first startup are considered for sending. Keep this folder for the PDFs you actually intend to email. Do not put confidential or third-party PDFs in it without permission.

This is a **local, file-triggered** sender. The dashboard's weekly release discovery and GitHub Actions run separately. The website's authenticated browser download step is **not** automated, and local sending does **not** update the web dashboard's issue delivery history.

The PC must be on and this program running when you want immediate delivery. You can later use Windows Task Scheduler to run `npm run pdf-inbox` periodically.
