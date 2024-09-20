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

# foo@example.com
event 'api/members/create' '{"memberNumber": "1234", "email": "foo@example.com"}'
