#!/bin/bash

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1234", "email": "foo@example.com"}' \
	http://localhost:8080/api/members/create

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1337", "email": "admin@example.com"}' \
	http://localhost:8080/api/members/create

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"memberNumber": "1337", "declaredAt": "2023-01-20"}' \
	http://localhost:8080/api/super-users/declare

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"id": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "name": "Metal Shop"}' \
	http://localhost:8080/api/areas/create

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"id": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "name": "Metal Lathe", "areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e"}' \
	http://localhost:8080/api/equipment/add

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
	--data '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "trainingSheetId": "fakeTrainingSheetId"}' \
	http://localhost:8080/api/equipment/add-training-sheet

