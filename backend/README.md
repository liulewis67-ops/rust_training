# Rust Path API

Windows PowerShell local startup:

```powershell
Copy-Item .env.example .env
# Set the issuer, confidential client ID/secret, fixed callback URL, and app origin.
cargo run --locked
```

The API requires an OIDC provider with discovery enabled and the exact callback URI registered. It uses authorization code flow with PKCE, session-bound state and nonce, validates the ID token through provider discovery metadata, and keeps session data server-side. The default development session store is process-local; production deployment must provide a shared persistent `tower-sessions` store before using multiple instances or expecting sessions to survive process restarts.

Set `COOKIE_SECURE=true` behind HTTPS. `COOKIE_SECURE=false` exists only for loopback development; the secure `__Host-` cookie name is used when Secure is enabled. The Vite development server proxies `/api` to the API listener.
