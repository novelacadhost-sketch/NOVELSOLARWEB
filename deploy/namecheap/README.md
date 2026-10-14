# Namecheap staging (staging.novelsolar.com)

A trial of the Namecheap Stellar Business host as a free alternative to Vercel.
Production is still Vercel.

## How it runs

- `.github/workflows/deploy-staging.yml` builds with `NITRO_PRESET=node-server` on
  every push to master, uploads `.output` plus `app.js` over SSH, and restarts.
- cPanel "Setup Node.js App" runs `app.js` from `~/novelsolar-staging`.
- `app.js` loads secrets from `~/novelsolar-staging.env` (same names as Vercel),
  copies them to the `NUXT_` names Nitro reads at runtime, then starts the server.
  The build itself has no secrets.

## One-time setup

1. cPanel → SSH Access → Manage SSH Keys → Import the deploy public key, then
   Authorize it.
2. Repo settings → Secrets and variables → Actions:
   - secret `STAGING_SSH_KEY`: the deploy private key
   - variables `STAGING_SSH_HOST`, `STAGING_SSH_USER` (the cPanel username),
     `STAGING_SSH_KNOWN_HOSTS` (`ssh-keyscan -p 21098 <host>`), and optionally
     `STAGING_SSH_PORT` (default 21098) and `STAGING_APP_DIR` (default
     `novelsolar-staging`)
3. Create the Node app (cPanel UI or, over SSH):
   `cloudlinux-selector create --json --interpreter nodejs --version 22 --app-root novelsolar-staging --domain staging.novelsolar.com --app-uri / --app-mode production --startup-file app.js`
4. Upload `~/novelsolar-staging.env` with `chmod 600`. Same variables as Vercel,
   except `NUXT_PUBLIC_BASE_URL=https://staging.novelsolar.com`.

## Debugging

- App output: `~/novelsolar-staging/stderr.log`
- Restart: `touch ~/novelsolar-staging/tmp/restart.txt`
- Staging shares the production Supabase project and Bitrix portal. An order
  placed here is a real order.
