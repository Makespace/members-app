#!/bin/bash

function event {
  echo $1 $2
  curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
    --data "$2" \
    http://localhost:8080/$1
  echo
}

# Metal shop
event 'api/areas/create' '{"id": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "name": "Metal Shop"}'

# Metal lathe
event 'api/equipment/add' '{"id": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "name": "Metal Lathe", "areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e"}'
event 'api/equipment/add-training-sheet' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "trainingSheetId": "fakeTrainingSheetId"}'

# Ada Admin (superuser)
event 'api/members/create' '{"memberNumber": "1337", "email": "admin@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "1337", "name": "Ada Admin"}'
event 'api/members/edit-pronouns' '{"memberNumber": "1337", "pronouns": "she/her"}'
event 'api/super-users/declare' '{"memberNumber": "1337"}'

# Owen Owner (owner of metal shop area)
event 'api/members/create' '{"memberNumber": "4150", "email": "owner@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "4150", "name": "Owen Owner"}'
event 'api/members/edit-pronouns' '{"memberNumber": "4150", "pronouns": "he/him"}'
event 'api/areas/add-owner' '{"areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "memberNumber": "4150"}'

# Treacle Trainer (Trainer for metal lathe)
event 'api/members/create' '{"memberNumber": "7777", "email": "trainer@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "7777", "name": "Treacle Trainer"}'
event 'api/members/edit-pronouns' '{"memberNumber": "7777", "pronouns": "they/them"}'
event 'api/equipment/mark-member-trained' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "7777"}'
event 'api/equipment/add-trainer' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "7777"}'

# Lucy Lathe (Trained on Lathe)
event 'api/members/create' '{"memberNumber": "8888", "email": "lathe@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "8888", "name": "Lucy Lathe"}'
event 'api/members/edit-pronouns' '{"memberNumber": "8888", "pronouns": "she/her"}'
event 'api/equipment/mark-member-trained' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "8888"}'

# Neon Newmember (has completed the lathe training sheet)
event 'api/members/create' '{"memberNumber": "9999", "email": "new@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "9999", "name": "Neon Newmember"}'
event 'api/members/edit-pronouns' '{"memberNumber": "9999", "pronouns": "they/them"}'
event 'api/equipment/add-training-quiz-result' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e","trainingSheetId": "fakeTrainingSheetId","id": "53367621-a448-4554-96eb-532a5ffe1e30","emailProvided": "new@example.com","memberNumberProvided": 9999,"score": 13,"maxScore": 20,"percentage": 65,"fullMarks": false,"timestampEpochS": 1718411504,"quizAnswers": {}}'
event 'api/equipment/add-training-quiz-result' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e","trainingSheetId": "fakeTrainingSheetId","id": "2c3fce39-68f5-4845-b520-1528374405d6","emailProvided": "new@example.com","memberNumberProvided": 9999,"score": 20,"maxScore": 20,"percentage": 100,"fullMarks": true,"timestampEpochS": 1718411504,"quizAnswers": {}}'

# foo@example.com
event 'api/members/create' '{"memberNumber": "1337", "email": "foo@example.com"}'

# Training
event 'api/equipment/add-training-quiz-result' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e","trainingSheetId": "fakeTrainingSheetId","id": "2d0e6174-a827-4331-9dc2-ffb05ea863c3","emailProvided": "finn.flatcoat@dog.co.uk","memberNumberProvided":1234,"score": 13,"maxScore": 20,"percentage": 65,"fullMarks": false,"timestampEpochS": 1718411504,"quizAnswers": {}}'
event 'api/equipment/add-training-quiz-result' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e","trainingSheetId": "fakeTrainingSheetId","id": "2d0e6174-a827-4331-9dc2-ffb05ea863c3","emailProvided": "finn.flatcoat@dog.co.uk","memberNumberProvided":1234,"score": 20,"maxScore": 20,"percentage": 100,"fullMarks": true,"timestampEpochS": 1718413504,"quizAnswers": {}}'

# Demonstrates html injection on the equipment page.
event 'api/equipment/add-training-quiz-result' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e","trainingSheetId": "fakeTrainingSheetId","id": "2d0e6174-a827-4331-9dc2-ffb05ea863c3","emailProvided":"<h1>myemail.com</h1>","memberNumberProvided":1234,"score": 20,"maxScore": 20,"percentage": 100,"fullMarks": true,"timestampEpochS": 1718413504,"quizAnswers": {}}'

