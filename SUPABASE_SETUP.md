# Supabase setup

The website uses Supabase Auth and Postgres for accounts, balances, deposit reviews, withdrawals, and wallet notifications. The publishable key in `backend-config.js` is intended for browser use; never put a Supabase Secret/service-role key in the website.

## 1. Create the database schema

In the Supabase dashboard for the `Filio Investment Hub` project, open **SQL Editor**, create a new query, paste in `supabase-schema.sql`, and run it. Confirm the query completes successfully before using the website.

## 2. Create the first admin account

1. Run the website from a local web server or deploy it to an HTTPS static host. Opening `index.html` directly as a `file://` URL is not supported by Supabase Auth.
2. In **Authentication → URL Configuration**, add your local site URL (for example, `http://localhost:8000`) and deployed HTTPS site URL as allowed redirect URLs.
3. Register the admin account from the normal user sign-up form, then confirm its email if Supabase asks.
4. In the Supabase SQL Editor, run the final `INSERT ... SELECT` statement at the bottom of `supabase-schema.sql`, replacing `admin@example.com` with that admin account’s email.
5. Sign in at `admin.html` using that Supabase Auth account. Admin access is granted by the database role, not by a password embedded in JavaScript.

## 3. Existing local-only accounts

Accounts and wallet balances saved by the previous browser-only version do not automatically move to Supabase. Users need to register through Supabase Auth. An admin can use **Credit wallet** to restore a verified balance, with an audit reason, after confirming the user’s identity and amount.

## Important operating notes

- Withdrawal requests are atomically held against the server-side wallet. Admin rejection returns the held amount; marking a request paid records the status after the admin sends the bank transfer.
- Deposit approvals and admin wallet credits update the wallet and transaction ledger in the database.
- Investment purchases and earnings are intentionally paused until their settlement rules can also be enforced by server-side database functions.
- This project does not send bank transfers. The admin must verify receipts and make approved payouts through their normal banking channel.
- Deposit receipt images are currently stored in the database; use Supabase Storage for receipts before scaling up.
- Run the site through a web server, for example `python -m http.server 8000`, then visit `http://localhost:8000/`.
