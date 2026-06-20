# Green Groceries — Hotel Fruits & Vegetables Ordering System

## Original Problem Statement
User shared an HTML mockup of a single hotel order form (Potato/Onion/Tomato/Garlic + Apple/Banana/Orange/Papaya) and asked for a real application that can take orders from **many hotels** and produce a **combined purchase sheet** for buying.

## User Choices (from ask_human)
- Auth: Admin login + Hotels register/login
- Catalog: Fixed default items + admin can add/edit/remove dynamically
- Aggregation: By single date AND by date range
- Extras: Order + sheet + CSV export + per-hotel history + status
- Design vibe: Clean B2B dashboard + fresh green/organic farm-market feel

## Architecture
- Backend: FastAPI + Motor (MongoDB). JWT (httpOnly cookie). Bcrypt password hashing. All routes under `/api`.
- Frontend: React (CRA + craco) + Tailwind + shadcn/ui + sonner toasts + framer-motion.
- DB: MongoDB collections `users`, `items`, `orders` with indexes on `email` (unique), `name` (unique items), `order_date`, `hotel_id`.
- Theme: Fraunces (serif headings) + Albert Sans (body) + JetBrains Mono. Deep botanical green `#1F4A2C`, warm cream `#F7F5F0`, earthy terracotta `#D4A373`.

## User Personas
- **Hotel manager** — registers their hotel, places daily produce order with quantities & notes, views history & status.
- **Admin / Buyer** — single login, monitors stats, sees every hotel's orders, updates status, manages catalog items, generates the combined purchase sheet (single date or range), exports CSV for mandi visit.

## Core Requirements (static)
1. Hotel auth (register/login/logout) + Admin auth (seeded).
2. Catalog with pre-seeded 10 items; admin CRUD.
3. Hotel order placement with date, notes, line items.
4. Admin view of all orders; status update (pending / delivered / cancelled).
5. Combined purchase sheet aggregation: single date OR date range.
6. CSV export of combined sheet.
7. Role-based route protection.

## Implemented (2026-02 — iter 1)
- Backend: full auth, items CRUD, orders CRUD, purchase-sheet endpoint, CSV export, stats, hotels list, admin seeding, 10 default items seeded.
- Frontend: Login + Register split-hero pages, Hotel dashboard (Place Order tabs + History), Admin dashboard (Stats grid + Purchase Sheet + Orders + Items + Hotels tabs).
- Testing: 25/25 backend tests pass, 12/12 frontend flows pass.

## Prioritized Backlog
- **P1** Hotel "cancel" (status change) instead of hard delete to preserve history.
- **P1** PDF export of combined purchase sheet (alongside CSV).
- **P1** Server-side check that order line item_id exists in catalog.
- **P2** Admin dashboard charts (Recharts) — weekly volume, top items, hotel leaderboard.
- **P2** Forgot/reset password flow (endpoint stubs exist in playbook).
- **P2** WhatsApp / email notification on new order (Twilio / Resend).
- **P2** Cut-off time logic ("orders past 10 PM go to day+1 sheet").
- **P3** Tighten CORS to explicit FRONTEND_URL.
- **P3** Migrate FastAPI `on_event` to lifespan context.
- **P3** Add DialogDescription for a11y.

## Next Tasks
1. Confirm with user: should hotel-side "Delete" become "Cancel"?
2. Decide if PDF export is required for first business demo.
3. Optional: enable notifications (Twilio/Resend) for new order alerts.
