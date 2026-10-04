# ZoomIntern Authentication Testing

## Admin session
- Sign in at `POST /api/admin/login` with the credentials in `/app/memory/test_credentials.md`.
- Confirm the response returns a JWT and sets the `zi_admin_access` httpOnly, Secure, SameSite=None cookie.
- Confirm `/api/admin/me` works with either that cookie or an Authorization bearer token.
- Submit five invalid passwords for the same email, then confirm the next attempt returns HTTP 429.

## Intern portal
- Issue a certificate for an address that can receive mail.
- Request a code with `POST /api/intern/access/request`.
- Verify the six-digit code with `POST /api/intern/access/verify` and use the returned bearer token at `GET /api/intern/certificates`.
- Confirm the response only contains certificates belonging to the verified email.