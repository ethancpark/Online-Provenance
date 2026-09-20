# Auth email templates

Paste these into the Supabase dashboard → **Authentication → Emails → Templates**.
They live here for the same reason the SQL does: the dashboard is the only place
they can be edited, and nothing else in the repo records what they are supposed
to say.

## Why they are not the defaults

Supabase's default template links to its own `/auth/v1/verify` endpoint:

```
{{ .ConfirmationURL }}
  → https://<project>.supabase.co/auth/v1/verify?token=…&type=recovery&redirect_to=…
```

Fetching that URL **spends the one-time token** and redirects to the app with a
session attached. That is fine for a webmail client that only shows the link,
and broken for a mailbox behind a link scanner.

Emory routes its mail through `emory-edu.mail.protection.outlook.com` —
Microsoft Defender for Office 365 — and so does most of the sector we are
writing to. Defender's Safe Links fetches every URL in every message to check it
before the recipient is allowed near it. That fetch is a GET, so it spends the
token. The recipient's own click then arrives at a link that has already been
used, and is told it expired. Asking for a fresh one produces another link the
scanner eats first, which is why it looks like every link is broken.

The templates below hand the token hash to our own page instead. Loading that
page verifies nothing; the token is spent only when someone presses the button
on it. Scanners follow links. They do not press buttons.

`{{ .SiteURL }}` is the project's **Site URL** under Authentication → URL
Configuration. It must be `https://onlineprovenance.vercel.app` (no trailing
slash) or these links will point at the wrong host.

## Reset password

Subject: `Reset your password`

```html
<h2>Reset your password</h2>

<p>We received a request to reset your password. Follow the link below and press
the button on the page to choose a new one.</p>

<p><a href="{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>

<p>If you didn't request this, you can safely ignore this email — nothing changes
until that button is pressed.</p>
```

## Invite user

Subject: `You've been invited to Online Provenance`

```html
<h2>Finish setting up your account</h2>

<p>Follow the link below and press the button on the page to confirm your
address and choose a password.</p>

<p><a href="{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a></p>

<p>If you weren't expecting this, you can safely ignore this email.</p>
```

## Also check

- **Authentication → Emails → Expiry.** The email OTP expiry defaults to one
  hour. The app no longer promises a specific number, but an hour is short for
  someone who reads their mail after a meeting — 24 hours (86400) is a
  reasonable setting for this audience and matches what the copy used to claim.
- **Authentication → URL Configuration → Site URL** must be the production
  origin, since these templates build the link from it.

`src/app/set-password/page.tsx` still accepts a link of the old shape — one that
arrives with a session already in place — so mail sent before this change is not
stranded.
