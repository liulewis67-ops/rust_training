# Rust Path API

Windows PowerShell local startup:

```powershell
Copy-Item .env.example .env
# Replace the SMTP example values with a local encrypted SMTP relay before sending mail.
cargo run --locked
```

By default, local email/password accounts are enabled and OIDC is disabled. `OIDC_ENABLED=true` enables the retained external OpenID Connect flow and requires the issuer, client ID/secret, and callback URL. Local account registration, email verification and password recovery require all six `SMTP_*` settings; startup validates them but does not contact the relay until an email is sent. `SMTP_TLS` must be `starttls_required` or `implicit_tls`.

`DATABASE_URL` selects the SQLite database file; startup adds the local account and session-owner schema and starts expiry cleanup. SMTP secrets belong only in the ignored local `.env` file. The example values are placeholders and cannot send email.

The local web pages are `/login`, `/register`, `/verify-email`, `/forgot-password`, and `/reset-password`. The API contract is in [`docs/contracts/auth.openapi.yaml`](../docs/contracts/auth.openapi.yaml). The Vite development server proxies `/api` to the API listener.

Set `COOKIE_SECURE=true` behind HTTPS. `COOKIE_SECURE=false` exists only for loopback development; the secure `__Host-` cookie name is used when Secure is enabled.
