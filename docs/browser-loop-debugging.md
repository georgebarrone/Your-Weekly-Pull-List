# Diagnosing repeated Playwright redirects

If the website loads normally in everyday Chrome/Incognito but the Playwright browser repeatedly reloads with a `?_ct=` address and HTTP `302 -> 404` responses, do not keep retrying login or running the scheduled PDF job.

The script only navigates to the homepage once. Repeated redirects may be caused by the site's session, verification, or server behavior. They cannot safely be fixed by changing the target URL or blocking verification requests.

## Safe compatibility test on Windows

Close every Playwright browser window, then open PowerShell in the repository:

```powershell
git pull
npm install
$env:PDF_BROWSER = "chrome"
npm run pdf-diagnose
```

The diagnostic uses **installed Chrome**, a **brand-new temporary browser profile**, and Chrome's normal sandbox. It opens the homepage and observes document responses for about 12 seconds, then closes the temporary browser automatically. It does not sign in, download files, or send email.

If the fresh-profile test succeeds, compare with the saved automation profile:

```powershell
npm run pdf-diagnose -- --saved
```

The terminal displays a brief result, and a privacy-filtered report is saved at `data/browser-diagnostic-chrome-fresh.json` or `data/browser-diagnostic-chrome-saved.json`. The report records status codes, paths and **query parameter names only**; it intentionally omits query values, authentication data, cookies, headers, page contents, and downloaded content.

## Interpret the result

- **Fresh profile loads; saved profile loops:** saved browser state is likely involved. Preserve the old profile and use a new dedicated automation profile, then sign in normally. Do not transfer cookies or other credentials between browser profiles.
- **Both fresh and saved profiles loop:** the Playwright-driven session is probably incompatible with the site's loading or verification process. The site operator would need to support/repair this use case; do not circumvent verification checks.
- **Neither shows a redirect loop:** try `npm run pdf-login` again with `PDF_BROWSER=chrome`. If it loads and login succeeds, only then run a dry run and a one-issue download test.

Chrome's sandbox has now been explicitly enabled in our launch settings; that removes the insecure `--no-sandbox` launch mode but **is not guaranteed to fix site-level redirects**. Never disable browser sandboxing just to get the page to load.

If you share results for debugging, send only the diagnostic's summary or its sanitized JSON. Never send your browser profile folder, a full `?_ct=` URL, cookies, passwords, or session tokens.
