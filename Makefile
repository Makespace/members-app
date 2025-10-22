.phony: check clear-containers dev dev-all fix lint prod release smoketest test typecheck unused-exports watch-typecheck populate-local-dev populate-full update-vendor

check: test lint typecheck unused-exports

node_modules: package.json bun.lockb
	bun install --frozen-lockfile

update-vendor: node_modules
	rm -rf ./src/static/vendor
	mkdir -p ./src/static/vendor/font-awesome/webfonts ./src/static/vendor/font-awesome/css
	cp ./node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css ./src/static/vendor/font-awesome/css/
	cp ./node_modules/@fortawesome/fontawesome-free/css/regular.min.css ./src/static/vendor/font-awesome/css/
	cp ./node_modules/@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2 ./src/static/vendor/font-awesome/webfonts/

.env:
	cp .env.example .env

dev: .env
	docker compose --file docker-compose.yaml --file docker-compose.dev.yaml up --build

populate-local-dev:
	bash ./scripts/populate-local-dev.sh

populate-full:
	bun ./scripts/populate-full.ts

fix: node_modules
	bun gts fix

prod:
	docker compose --file docker-compose.yaml up --build

test: node_modules
	npx jest

smoketest: .env
	./scripts/smoketest.sh

lint: node_modules
	bun gts lint

unused-exports: node_modules
	bun ts-unused-exports ./tsconfig.json

typecheck: node_modules
	bun tsc --noEmit

watch-typecheck: node_modules
	bun tsc --noEmit --watch

clear-containers:
	docker compose --file docker-compose.yaml --file docker-compose.dev.yaml down -v

release: export TAG = latest/$(shell date +%Y%m%d%H%M)
release:
	git tag $$TAG
	git push origin $$TAG
