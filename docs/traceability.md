# Traceability Matrix (Requirements → Tests)

| Requirement | Test File | Type |
| --- | --- | --- |
| Auth login success/failure/lock/reset | apps/api/tests/auth.test.ts | API Integration |
| Projects/Cards CRUD + ownership | apps/api/tests/projects_cards.test.ts | API Integration |
| Calendar integrations (connect/refresh/disconnect/validations) | apps/api/tests/calendar_integrations.test.ts | API Integration |
| Calendar events range + TZ | apps/api/tests/calendar_events.test.ts | API Integration |
| Dashboard metrics KPIs/totals/upcoming | apps/api/tests/dashboard_metrics.test.ts | API Integration |
| Observability & Security (headers, CORS, 422, metrics, sanitization) | apps/api/tests/observability_security.test.ts | API Observability |
| Boards drag & drop + due date chip (mount) | apps/web/src/components/CardDueDateChip.spec.ts | Web Unit |
| Login form submits credentials | apps/web/src/pages/login.spec.ts | Web Unit |
| E2E happy path (login→DnD→fecha→dashboard) + axe checks | tests/e2e/happy-path.spec.ts | E2E + A11y |

Notes:
- Coverage thresholds: API ≥85%, Web ≥70%.
- Axe a11y checks are best-effort in CI; critical violations should fail tests.
