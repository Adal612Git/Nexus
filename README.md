# Nexus Monorepo

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
pnpm run e2e
```

## Notas

* `apps/web` usa Vite + Vue 3. Para migrar a Quasar: `pnpm dlx @quasar/cli create` y mueve el proyecto dentro de `apps/web` o integra `@quasar/vite-plugin`.
* `apps/api` sirve en `http://localhost:$API_PORT`.

