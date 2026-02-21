# fuzzypeanut/shell

The FuzzyPeanut shell — SvelteKit SPA (module federation host) + Python registry service.

Handles OIDC auth via Authentik, discovers installed modules at runtime, provides the `@fuzzypeanut/sdk` singleton to all loaded modules.

## Structure

| Path | Purpose |
|---|---|
| `src/` | SvelteKit frontend (static compile, adapter-static) |
| `src/lib/sdk.ts` | Shell-side SDK implementation injected as `@fuzzypeanut/sdk` singleton |
| `src/lib/stores/` | Auth, registry, notifications, theme — Svelte 5 rune-based |
| `src/lib/modules.ts` | Dynamic module loader via Vite module federation |
| `src/routes/[...path]/` | Renders whichever module owns the current path |
| `registry/` | Python FastAPI registry — modules register here on startup |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_OIDC_AUTHORITY` | `http://localhost:9000/application/o/fuzzypeanut/` | Authentik OIDC authority |
| `VITE_OIDC_CLIENT_ID` | `fuzzypeanut-shell` | OIDC client ID |
| `VITE_OIDC_REDIRECT_URI` | `http://localhost:5173/auth/callback` | OIDC callback URL |
| `VITE_REGISTRY_URL` | `http://localhost:3100` | Registry service base URL |

## Dev

```bash
npm install   # requires Node 20+
npm run dev
```

Registry:
```bash
cd registry
pip install -r requirements.txt
uvicorn main:app --reload --port 3100
```

## License

MIT
