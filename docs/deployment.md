# Deployment steps

## Render Blueprint

`render.yaml` defines a free Node web service with a health check and generated admin token. From Render, create a **Blueprint**, connect `AbdullohXX/marketplace-app`, and select the branch containing this file. Enter `DATABASE_URL` and `MONGODB_URI` in Render's secure prompts. These must point to dedicated cloud databases, not this workspace's loopback containers. Check the displayed plan before creating resources. A free web service can sleep while idle.

The Blueprint runs the idempotent schema/demo-data setup before starting the server. Existing application records are retained. It creates demonstration activity in the configured databases, so use new course databases. Automatic deploys are off; trigger future deploys manually after reviewing changes.

After the service becomes healthy, copy the HTTPS address from Render and test `/api/health`, product browsing, a MongoDB-backed review, and a two-seller checkout. Publication is complete only after those public checks pass.

## Cloud databases and manual deployment

1. Create a PostgreSQL project in Supabase or Neon and a MongoDB Atlas database. Use their supported connection strings, database users, trusted CA configuration and network access controls. Do not expose local development containers to the Internet.
2. Set `DATABASE_URL`, `MONGODB_URI`, `MONGODB_DB`, a random `ADMIN_TOKEN` of 32+ characters, and `PORT` in your hosting provider's secret settings. Do not put secrets in source files, logs, command arguments, screenshots, or report examples. Percent-encode special characters in PostgreSQL URL credentials.
3. Run `npm ci` and `npm run db:setup` using those credentials from an authorized machine. This loads demonstration records and generated activity: clearly identify this as sample data in the report. Use a dedicated course database, not an existing production database.
4. Push the reviewed code to your own GitHub repository, then create a Render Node web service. Build: `npm ci`. Start: `npm start`. Health path: `/api/health`. No build/bundling step is needed for the plain HTML/CSS/JS front end. The server binds to `0.0.0.0` and respects the assigned `PORT`.
5. If the hosting path has exactly one trusted reverse proxy, set `TRUST_PROXY=1`. Otherwise leave `0` and configure Express for your actual proxy topology before relying on IP-based limits. Use HTTPS. Match Atlas network restrictions to your hosting provider's supported outbound networking; do not assume the course cloud runtime's HTTP proxy supports MongoDB's native TCP protocol.
6. Run the full test plan against the deployed app. Use disposable databases for the integration suite. Check the health response, browse a product, post feedback, place a multi-seller demo order, and verify the SQL rows and MongoDB documents directly. Test mobile and empty/error cases.

This repo includes deployment instructions, not a published URL. Hosting accounts, secure connection strings, and provider access must be supplied by the owner. No real payment gateway, refunds, delivery integration, customer login, or seller ownership model is included. Before operating a real business, implement those features plus customer consent/privacy controls, review moderation, idempotent checkout retries, and operational backups.
