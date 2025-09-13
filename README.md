# Nexus Monorepo

![API Coverage](apps/api/coverage/badge.svg) ![Web Coverage](apps/web/coverage/badge.svg)

Monorepo con **apps/api** (Express + TS) y **apps/web** (Vite + Vue 3). Preparado para integrar **Quasar** más adelante.

## Requisitos
- Node.js >= 20
- pnpm >= 9 (`corepack enable` y listo)

## Setup
```bash
pnpm install
cp .env.example .env
```

## Desarrollo

* Levantar API + Web en paralelo:

```bash
make dev
```

* Sólo API:

```bash
make api
```

* Sólo Web:

```bash
make web
```

## Lint / Format

```bash
pnpm run lint
pnpm run format
```

## Build / Test / E2E

```bash
pnpm run build
pnpm run test
pnpm run coverage:api && pnpm run coverage:web && pnpm run coverage:badges
pnpm run e2e
```

## Testing

- API (Vitest) usa una base SQLite dedicada: `apps/api/prisma/test.db`.
- El runner ajusta `NODE_ENV=test` y `DATABASE_URL=file:./test.db` automáticamente al correr tests en `apps/api`.
- Antes de ejecutar tests se aplican migraciones (`prisma migrate deploy`). Entre tests se limpian tablas y se inserta un seed mínimo.
- Comandos útiles:
  - `pnpm --filter @nexus/api run test` — corre los tests sobre `test.db` aislada.
  - `pnpm --filter @nexus/api run test:watch` — modo watch.
  - `pnpm --filter @nexus/api run test:ci` — pensado para CI.
- Para resetear manualmente la DB de test:
  - Elimina el archivo `apps/api/prisma/test.db` o ejecuta `npx prisma db push --force-reset` dentro de `apps/api` con `NODE_ENV=test`.
- Diferencias:
  - Dev usa `dev.db` con `pnpm --filter @nexus/api run db:migrate` y `db:seed`.
  - Test nunca toca `dev.db` y crea datos controlados por test.

## E2E

Antes de correr Playwright por primera vez o cuando cambies el esquema, resetea la base de datos de desarrollo para asegurar el usuario demo:

```bash
pnpm --filter @nexus/api run db:reset
make dev
pnpm run e2e
```

El seed crea `demo@nexus.dev / password123` y datos de ejemplo. Los tests E2E utilizan esas credenciales.

## Quality & Traceability

- Coverage thresholds: API ≥85%, Web ≥70%.
- Traceability matrix: see `docs/traceability.md`.

## Notas

* `apps/web` usa Vite + Vue 3. Para migrar a Quasar: `pnpm dlx @quasar/cli create` y mueve el proyecto dentro de `apps/web` o integra `@quasar/vite-plugin`.
* `apps/api` sirve en `http://localhost:$API_PORT`.
