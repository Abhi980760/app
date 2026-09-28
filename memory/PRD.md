# ZoomIntern — Product Requirements Document

## Original Problem Statement
Build an internship-providing website (ZoomIntern) with an admin portal where the CEO (Abhishek Singh Tomar) can issue certificates to interns. Admin enters intern name, start date, end date, and area of internship. When issued, the certificate is emailed to the intern as a PDF. Public certificate verification. CEO signature matches the reference screenshot.

## User Choices
- Name: ZoomIntern
- Email: Resend (Emergent-managed; API key currently empty — graceful skip)
- Admin auth: Simple email + password (from `.env`), JWT-based
- CEO signature: Stylized generated signature (Times-BoldItalic + gold underline flourish)
- Public verification: Unique cert IDs (ZI-YYYY-XXXX) + QR code

## Architecture
- Backend: FastAPI + Motor (MongoDB), bcrypt + PyJWT, ReportLab (PDF), qrcode, Resend SDK
- Frontend: React 19 + React Router v7 + TailwindCSS + shadcn/ui + Sonner toasts
- All backend routes prefixed `/api`; frontend uses `REACT_APP_BACKEND_URL`

## What's Been Implemented (2026-09-28)
- Public landing (`/`) — hero, stats, features, featured programs, certificate showcase
- Public internships directory (`/internships`) with area filter + Apply modal
- Public certificate verify (`/verify`) with ID lookup + PDF link
- Admin login (`/admin/login`) + JWT-protected dashboard (`/admin`)
- Admin Command Center: stats (Programs / Applications / Pending / Certificates)
- Tabs: Certificates (issue form, PDF download, resend email, delete), Applications (status change), Programs (CRUD)
- ReportLab PDF certificate: navy border, gold corner ornaments, ZI watermark, QR verification, signed by Abhishek Singh Tomar
- Seeded admin + 9 default programs

## Test Results
Iteration 1: 100% pass (backend 11 endpoints, frontend 5 flows). Report: `/app/test_reports/iteration_1.json`.

## Admin Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Next
- P1: Upload real CEO signature image (currently stylized)
- P1: Add branded verified sender domain in Resend once API key is provided
- P2: Assessments (auto-grading quiz gating certificate issuance)
- P2: Intern dashboard (self-service certificate download)
- P2: WhatsApp send via Twilio for one-click delivery
