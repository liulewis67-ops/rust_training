# Rust Path API

Windows PowerShell local startup:

```powershell
Copy-Item .env.example .env
# Set the issuer, confidential client ID/secret, fixed callback URL, app origin, and local PostgreSQL URL.
cargo run --locked
```

The API requires an OIDC provider with discovery enabled, the exact callback URI registered, and a PostgreSQL database. It uses authorization code flow with PKCE, session-bound state and nonce, validates the ID token through provider discovery metadata, and stores server sessions in PostgreSQL so instances share revocation and session state. Startup applies the additive `auth_sessions` schema and starts expiry cleanup.

Set `COOKIE_SECURE=true` behind HTTPS. `COOKIE_SECURE=false` exists only for loopback development; the secure `__Host-` cookie name is used when Secure is enabled. The Vite development server proxies `/api` to the API listener.
