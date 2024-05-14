#!/usr/bin/env bash
set -euo pipefail

function finish() {
  echo "Stopping all containers"
	docker-compose logs
	docker-compose stop
}

trap finish EXIT

docker-compose down
docker-compose up --build -d

timeout --foreground 20 bash << EOT
  while true; do
    sleep 1
		status=\$(curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ping)
		if [ "\$status" != "200" ]; then
			continue
		fi

		curl \
			-X POST \
			-H 'Authorization: Bearer secret' \
			-H 'Content-Type: application/json' \
			--data '{"memberNumber": "1234", "email": "foo@example.com"}' \
			http://localhost:8080/api/link-number-to-email

		curl -s -o /dev/null \
			"http://localhost:8080/auth" \
			-X POST \
			-H "Content-Type: application/x-www-form-urlencoded" \
			-d "email=foo@example.com"
		docker-compose logs | grep 'Received message from'
		if [ "\$?" != "0" ]; then
			continue
		fi

		echo "Smoketest successful"
		break
  done
EOT