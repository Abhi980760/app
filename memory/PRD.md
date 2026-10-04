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
- Program Classroom (`/programs/:programId`): public class sequencing, YouTube lessons, configurable pass-score quizzes, and mixed MCQ/descriptive answers
- Admin Classroom Builder (`/admin/programs/:programId/classes`): add/delete classes, YouTube links, class order, selected class-level PDF project requirements, and final-project settings
- Private project submission system: PDF-only class/final uploads, application-email validation, managed object storage, opaque receipt tokens, and protected PDF download routes for interns/admins

## Test Results
- Iteration 1: 9/9 backend feature/regression tests passed, including managed email delivery, signature upload, PDF output, WhatsApp handoff, intern access request, invalid code handling, and public verification. Report: `/app/test_reports/iteration_1.json`.
- Manual validation: PDF download (200 / `application/pdf`), cookie session, login lockout (`401 × 5`, then `429`), frontend production build, and desktop/mobile portal overflow checks all passed.
- Iteration 2: 22/22 backend regression tests passed for classroom setup, answer privacy, quiz scoring, class/final PDF uploads, receipt-protected downloads, application gating, and managed preview CORS preflight. Frontend classroom builder and public classroom flows passed in Playwright at desktop and mobile widths. Report: `/app/test_reports/iteration_2.json`.

## Admin Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Next
- P1: Add a custom verified sending domain and reply inbox when ZoomIntern has one.
- P1: Optional direct WhatsApp Business provider integration for automated sends; current implementation opens a compliant prefilled WhatsApp handoff for the admin to review and send.
- P1: Add an admin review screen for descriptive quiz answers and submitted project PDFs, with approve/request-changes statuses.
- P2: Gate certificate issuance behind final-project approval and required quiz completion.
- P2: Certificate revocation reason/history and a public revocation status view.

## Last Validation
- 2026-10-04: Production build, authenticated certificate flows, managed email delivery, PDF generation, portal access request, signature storage, cookie session, login lockout, program classroom, quizzes, and project PDF submission workflows were verified.
