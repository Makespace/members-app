.phony: dev

dev:
	docker build -t member-number-lookup . \
	&& docker run \
		-it \
		-v $(CURDIR)/src:/app/src \
		-p 8080:8080 \
		member-number-lookup