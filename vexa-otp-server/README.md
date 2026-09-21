# VEXA OTP Server

Production-oriented WhatsApp OTP backend for the VEXA OTP frontend.

## API

- `GET /api/health`
- `POST /api/v1/otp/send` with `{ "phone": "9647XXXXXXXXX" }`
- `POST /api/v1/otp/verify` with `{ "request_id": "...", "code": "123456" }`

When deployed on Vercel, use the public API base URL without `/api` only if routes are rewritten accordingly. Otherwise set the frontend API base to the deployment URL plus `/api` so the frontend calls `/api/health`, `/api/v1/otp/send`, and `/api/v1/otp/verify`.

## Required production setup

1. Create a dedicated Supabase project for VEXA OTP.
2. Run `sql/001_init.sql` in that project.
3. Deploy this folder as a Vercel project.
4. Add the variables from `.env.example` as server-side environment variables. Never put real Meta or Supabase secrets in GitHub Pages or browser JavaScript.
5. In Meta WhatsApp Manager, connect a WhatsApp Business phone number and create/approve an authentication template matching `WHATSAPP_TEMPLATE_NAME` and `WHATSAPP_TEMPLATE_LANG`.
6. Put the deployed API base URL in the VEXA OTP frontend settings and verify `/health` turns online.

## Security defaults

- 6-digit cryptographically generated OTP.
- 5-minute expiry.
- Maximum 5 verification attempts.
- Maximum 5 OTP requests per phone hash per 15 minutes.
- Maximum 20 OTP requests per IP hash per 15 minutes.
- Phone number and IP are stored only as HMAC hashes in the OTP table.
- OTP is stored only as an HMAC hash.
- Supabase table has RLS enabled and access revoked from `anon` and `authenticated`.
- Meta access token, phone number ID, Supabase secret key, and OTP pepper remain server-side only.

## WhatsApp provider

The sender uses Meta WhatsApp Cloud API at:

`POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages`

It sends the OTP through an approved message template. Adjust the template components if the approved Meta authentication template includes a copy-code or one-tap button.
