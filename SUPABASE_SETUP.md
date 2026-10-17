# Supabase setup

The website uses Supabase Auth and Postgres for accounts, balances, deposit reviews, withdrawals, and wallet notifications. The publishable key in `backend-config.js` is intended for browser use; never put a Supabase Secret/service-role key in the website.

## 1. Create the database schema

In the Supabase dashboard for the `Filio Investment Hub` project, open **SQL Editor**, create a new query, paste in `supabase-schema.sql`, and run it. Confirm the query completes successfully before using the website.

## 2. Create the first admin account

1. The site is published on GitHub Pages at `https://mumschild.github.io/filio-investment-hub/`. Opening `index.html` directly as a `file://` URL is not supported by Supabase Auth.
2. In **Authentication → URL Configuration**, set the **Site URL** to `https://mumschild.github.io/filio-investment-hub/` and add `https://mumschild.github.io/filio-investment-hub/**` under **Redirect URLs**. For local testing with VS Code Live Server, also add `http://127.0.0.1:5500/**`.
3. Register the admin account from the normal user sign-up form, then confirm its email if Supabase asks.
4. In the Supabase SQL Editor, run the final `INSERT ... SELECT` statement at the bottom of `supabase-schema.sql`, replacing `admin@example.com` with that admin account’s email.
5. Sign in at `admin.html` using that Supabase Auth account. Admin access is granted by the database role, not by a password embedded in JavaScript.

The signup email redirects to the site's current folder, so the GitHub Pages project path is preserved. If an email was sent before these URL settings were updated, request a new confirmation email; an older link may still point to the previous URL.

## 3. Existing local-only accounts

Accounts and wallet balances saved by the previous browser-only version do not automatically move to Supabase. Users need to register through Supabase Auth. An admin can use **Credit wallet** to restore a verified balance, with an audit reason, after confirming the user’s identity and amount.

## Important operating notes

- Withdrawal requests are atomically held against the server-side wallet. Admin rejection returns the held amount; marking a request paid records the status after the admin sends the bank transfer.
- Deposit approvals and admin wallet credits update the wallet and transaction ledger in the database.
- Investment purchases and earnings are intentionally paused until their settlement rules can also be enforced by server-side database functions.
- This project does not send bank transfers. The admin must verify receipts and make approved payouts through their normal banking channel.
- Deposit receipt images are currently stored in the database; use Supabase Storage for receipts before scaling up.
- The default Supabase email sender uses Supabase's default templates. To customize the subject and HTML design, configure custom SMTP under **Authentication → Emails → SMTP Settings**, then edit **Authentication → Emails → Templates**. Do not put SMTP credentials in website files.
- For local testing, run the site through a web server, for example `python -m http.server 8000`, then visit `http://localhost:8000/`; add that URL as an allowed redirect in Supabase if using this alternative.
