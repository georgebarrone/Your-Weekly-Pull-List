# Your Weekly Pull List

A small, private dashboard for managing a personal comic reading list.

## Features

- PIN-protected dashboard
- Searchable series and weekly release listings
- Subscription management and delivery history
- Weekly email notifications
- Optional PDF attachments from sources the operator is authorized to share

## Development

Built with Node.js, Express, and libSQL. Designed for deployment with a hosted database and scheduled jobs.

Run locally with Node.js 22+:

```bash
npm install
cp .env.example .env
npm start
```

Configure required environment variables privately. Do not commit secrets, credentials, or personal information.

Run checks with `npm test`.
