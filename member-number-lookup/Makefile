.phony: dev fix test

node_modules: package.json package-lock.json
	npm install

dev:
	docker-compose up --build

fix: node_modules
	npm run fix

test: node_modules
	npm run test
