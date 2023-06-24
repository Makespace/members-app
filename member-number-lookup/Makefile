.phony: check dev fix prod test typecheck lint

check: test lint typecheck

node_modules: package.json package-lock.json
	npm install
	touch node_modules

dev:
	docker-compose --file docker-compose.yaml --file docker-compose.dev.yaml up --build

fix: node_modules
	npx gts fix

prod:
	docker-compose --file docker-compose.yaml up --build

test: node_modules
	npx jest

lint: node_modules
	npx gts lint

typecheck: node_modules
	npx tsc --noEmit
