#!/bin/bash

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1234", "email": "foo@example.com"}' \
	http://localhost:8080/api/link-number-to-email

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1337", "email": "admin@example.com"}' \
	http://localhost:8080/api/link-number-to-email

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1337", "declaredAt": "2023-01-20"}' \
	http://localhost:8080/api/super-users/declare
