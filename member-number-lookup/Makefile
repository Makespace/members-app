.phony: dev test

node_modules: package.json package-lock.json
	npm install

dev:
	docker-compose up --build

test: node_modules
	npm run test
