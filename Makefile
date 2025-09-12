# Usa pnpm por defecto; puedes sobreescribir: `make dev PKG=npm`
PKG ?= pnpm

.PHONY: install dev api web build test e2e lint format clean verify-auth

install:
	$(PKG) install

dev:
	$(PKG) run dev

api:
	$(PKG) --filter @nexus/api run dev

web:
	$(PKG) --filter @nexus/web run dev

build:
	$(PKG) -r run build

test:
	$(PKG) -r run test

e2e:
	$(PKG) run e2e

lint:
	$(PKG) run lint

format:
	$(PKG) run format

clean:
	rm -rf node_modules apps/*/node_modules apps/*/dist .quasar playwright-report test-results

verify-auth:
	$(PKG) --filter @nexus/api run db:reset
	concurrently -n api,web -c auto "$(PKG) --filter @nexus/api dev" "$(PKG) --filter @nexus/web dev" &
	sleep 3
	$(PKG) --filter @nexus/api run test || true
	$(PKG) run e2e
