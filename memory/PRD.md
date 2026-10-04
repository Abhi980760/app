# ZoomIntern — Product Requirements Document

## Original Problem Statement
Build an internship-providing website (ZoomIntern) with an admin portal where the CEO (Abhishek Singh Tomar) can issue certificates to interns. Admin enters intern name, start date, end date, and area of internship. When issued, the certificate is emailed to the intern as a PDF. Public certificate verification. CEO signature matches the reference screenshot.

## User Choices
- Name: ZoomIntern
- Email: Emergent-managed transactional email delivery, with ZoomIntern as the sender display name
- Admin auth: Simple email + password (from `.env`), JWT-based
- CEO signature: Admin-uploaded PNG/JPEG/WEBP image when available; stylized generated fallback
- Public verification: Unique cert IDs (ZI-YYYY-XXXX) + QR code

## Architecture
- Backend: FastAPI + Motor (MongoDB), bcrypt + PyJWT, ReportLab (PDF), qrcode, Emergent managed email, Emergent object storage
- Frontend: React 19 + React Router v7 + TailwindCSS + shadcn/ui + Sonner toasts
- All backend routes prefixed `/api`; frontend uses `REACT_APP_BACKEND_URL`

## What's Been Implemented (2026-10-04)
- Public landing (`/`) — hero, stats, features, featured programs, certificate showcase
- Public internships directory (`/internships`) with area filter + Apply modal
- Public certificate verify (`/verify`) with ID lookup + PDF link
- Admin login (`/admin/login`) + JWT-protected dashboard (`/admin`)
- Admin Command Center: stats (Programs / Applications / Pending / Certificates)
- Tabs: Certificates (issue form, PDF download, resend email, delete), Applications (status change), Programs (CRUD)
- ReportLab PDF certificate: navy border, gold corner ornaments, ZI watermark, QR verification, signed by Abhishek Singh Tomar
- Seeded admin + 9 default programs
- Managed transactional email delivery for certificate notices and intern one-time portal codes
- Secure intern portal (`/portal`) with an emailed 6-digit access code and self-service PDF downloads
- CEO signature uploader stored through managed object storage and rendered in new certificate PDFs
- Optional E.164 WhatsApp number on certificates plus a one-click, prefilled WhatsApp sharing handoff
- Admin session hardening: httpOnly session cookie, bearer fallback, five-attempt/15-minute login lockout, password-drift seed updates, and explicit CORS origin policy

## Test Results
- Iteration 1: 9/9 backend feature/regression tests passed, including managed email delivery, signature upload, PDF output, WhatsApp handoff, intern access request, invalid code handling, and public verification. Report: `/app/test_reports/iteration_1.json`.
- Manual validation: PDF download (200 / `application/pdf`), cookie session, login lockout (`401 × 5`, then `429`), frontend production build, and desktop/mobile portal overflow checks all passed.

## Admin Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Next
- P1: Add a custom verified sending domain and reply inbox when ZoomIntern has one.
- P1: Optional direct WhatsApp Business provider integration for automated sends; current implementation opens a compliant prefilled WhatsApp handoff for the admin to review and send.
- P2: Assessments with auto-grading before certificate issuance.
- P2: Certificate revocation reason/history and a public revocation status view.

## Last Validation
- 2026-10-04: Production build, authenticated certificate flows, managed email delivery, PDF generation, portal access request, signature storage, cookie session, and login lockout were verified.
