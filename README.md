# Mental Health Accountability App

This is a code bundle for Mental Health Accountability App. The original project is available at https://www.figma.com/design/OmoKuWijoSjf4mXtmOrVWE/Mental-Health-Accountability-App.

## Running the code

### Frontend only (demo mode)

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

To use in-memory/localStorage data only, do not set `VITE_API_URL`. Sign up with any email (no password required in demo mode).

### With backend (PostgreSQL on DigitalOcean)

1. **Server**
   - `cd server`
   - Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET` (min 32 chars), and optionally `CORS_ORIGIN` and `PORT`.
   - Run `npm install`
   - Run `npm run db:init` to create tables (once per database).
   - Run `npm run dev` to start the API at http://localhost:3001.

2. **Frontend**
   - In the project root, set `VITE_API_URL=http://localhost:3001` in `.env` (or use the provided `.env`).
   - Run `npm i` and `npm run dev`.

3. **Auth**
   - Sign up with email + password; the backend stores hashed passwords and issues a JWT. Log in with the same credentials.

### Database connection timeout? (DigitalOcean)

If you see **"Request timed out"** or **ETIMEDOUT** when using a DigitalOcean managed database, the DB firewall is blocking your IP. The database only accepts connections from **Trusted Sources**.

1. In [DigitalOcean](https://cloud.digitalocean.com/) go to **Databases** → your cluster → **Settings**.
2. Under **Trusted Sources**, click **Edit**.
3. Either:
   - **Add your current IP**: click **Add current IP address**, or  
   - **Allow all** (for testing only): add `0.0.0.0/0`.
4. Save. Wait a minute, then try signing up again.

Your app runs on your machine, so the IP that must be allowed is the one your machine uses to reach the internet (your home/office or VPN). If you deploy the backend to a server later, add that server’s IP to Trusted Sources as well.