.phony: dev fix prod test

node_modules: package.json package-lock.json
	npm install

dev:
	docker-compose --file docker-compose.yaml --file docker-compose.dev.yaml up --build

fix: node_modules
	npm run fix

prod:
	docker-compose --file docker-compose.yaml up --build

test: node_modules
	npm run test
