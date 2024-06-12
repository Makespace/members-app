#!/bin/bash

curl -X POST \
	-H 'Authorization: Bearer '$ADMIN_API_BEARER_TOKEN \
	-H 'Content-Type: application/json' \
	--data '{"memberNumber": "'$1'", "email": "'$2'"}' \
	$PUBLIC_URL/api/members/create
echo -e "\t$1\t$2"


