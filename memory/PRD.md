# Bubba Pizza Hub — PRD

## Original Problem Statement
"Here's a HTML from Claude, can you make this an app?" — Convert the single-file HTML prototype `bubba-hub.html` ("Bubba Pizza Hub") into a native Expo mobile app. It is an internal franchise operations tool for a pizza chain.

## User Choices
- Real FastAPI + MongoDB backend with persistence/sync across devices.
- Secure JWT auth (bcrypt hashing), seeded with the HTML's demo accounts.
- Keep the Bubba brand (red #d7141a / black, Figtree font); redesign for native mobile (bottom tabs, bottom sheets, cards, chips).
- Light + dark mode, auto-switching with the device.

## Architecture
- **Backend** `/app/backend/server.py` — FastAPI, MongoDB (motor), JWT (pyjwt), bcrypt. All routes under `/api`. Idempotent startup seed (stores, users, templates, announcements, sample checks).
- **Frontend** — Expo Router. Providers in `app/_layout.tsx` (ErrorBoundary, GestureHandler, SafeArea, ReactQuery, Keyboard, Auth, BottomSheetModal, Toast). Figtree fonts via expo-font. Icons via @react-native-vector-icons/ionicons (JS-bundled for Expo Go).
- **Theme** `src/theme.ts` — light + dark tokens from design_guidelines.json, makeStyles/useTheme.
- **Auth** `src/auth/auth-context.tsx` + `src/api/client.ts`, token in expo-secure-store via `@/src/utils/storage`.

## User Personas
- **Company account** — head office; all stores, full account + template management.
- **Franchisee** — owns specific stores; manages staff/managers within their own stores; reviews checks.
- **Manager / Staff** — (addable) submit checks; managers can review.

## Core Requirements (static)
- Username/password login; role-based access.
- Home dashboard: welcome, quick actions (Store Checks, Incident Reports*, Training*), announcements.
- Store Checks: create (temperature readings / cleaning checklist, Open/Close shift), review (approve/return), list with status + store filters.
- Account Management (company + franchisee).
- Store Check template Management (company only): per-store custom layouts, add new check types.
- Account settings: edit details, change password.
- Light + dark themes.
(*Incident Reports and Training are placeholder quick actions — "coming next" toast.)

## Implemented (2026-06)
- JWT auth: login, /me, update details, change password. Seeded 6 company + 3 franchisee accounts (password `password`).
- Checks: list (store-scoped), submit (server computes done/total/bad), review approve/return.
- Templates: list with per-store overrides; company edit/reset layout; add new check type.
- Accounts: list (role-scoped), create/edit/soft-delete, with franchisee store-subset + role restrictions.
- Full native UI: sign-in, tabs (Home/Checks/Manage/Account), New Check form, bottom-sheet add/edit account, template editor.
- Light + dark mode, Figtree, brand red/black, Ionicons, toasts.
- Verified: 29/29 backend pytest + full frontend e2e via testing agent.

## Backlog / Remaining
- **P1**: Incident Reports module (log accident/injury/issue). Training module (courses/guides).
- **P2**: Date picker for DOB; check detail view with the actual recorded readings; search in checks list.
- **P2**: Native tabs (NativeTabs) on iOS 26+ (currently classic Tabs for all platforms due to role-conditional tabs).

## Next Tasks
- Build Incident Reports as a real module (list + create form) mirroring Store Checks.
- Add a check-detail screen showing each reading/item value.
