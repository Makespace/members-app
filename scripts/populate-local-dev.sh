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
event 'api/areas/set-mailing-List' '{"id": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "email": "metalshop@example.com"}'

# Metal lathe (Red - needs training)
event 'api/equipment/add' '{"id": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "name": "Metal Lathe", "areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "classification": "Red"}'
event 'api/equipment/add-training-sheet' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "trainingSheetId": "19e610we8nSzo3QO-T76RzdVoCNjq75my4Fkc0eDgmSo"}'

# Wood Shop - Orange/Green (no training) equipment
event 'api/areas/create' '{"id": "aaaaaaaa-0000-4000-8000-000000000001", "name": "Wood Shop"}'
event 'api/equipment/add' '{"id": "aaaaaaaa-0000-4000-8000-000000000002", "name": "Belt Sander", "areaId": "aaaaaaaa-0000-4000-8000-000000000001", "classification": "Orange"}'
event 'api/equipment/add' '{"id": "aaaaaaaa-0000-4000-8000-000000000003", "name": "Bandsaw", "areaId": "aaaaaaaa-0000-4000-8000-000000000001", "classification": "Green"}'

# 3D Printers
event 'api/areas/create' '{"id": "aaaaaaaa-0000-4000-8000-000000000004", "name": "3D Printers"}'
event 'api/equipment/add' '{"id": "aaaaaaaa-0000-4000-8000-000000000005", "name": "Bambu 3D Printer", "areaId": "aaaaaaaa-0000-4000-8000-000000000004", "classification": "Orange"}'

# Management - catch-all area for general trouble tickets
event 'api/areas/create' '{"id": "aaaaaaaa-0000-4000-8000-000000000006", "name": "Management"}'
event 'api/equipment/add' '{"id": "aaaaaaaa-0000-4000-8000-000000000007", "name": "General", "areaId": "aaaaaaaa-0000-4000-8000-000000000006", "classification": "Green"}'

# Ada Admin (superuser)
event 'api/members/create' '{"memberNumber": "1337", "email": "admin@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "1337", "name": "Ada Admin"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "1337", "formsOfAddress": "she/her"}'
event 'api/super-users/declare' '{"memberNumber": "1337"}'

# Owen Owner - owns Metal Shop plus the non-training areas and Management, but is not a
# trainer, so he exercises the owner-can-manage-tickets path.
event 'api/members/create' '{"memberNumber": "4150", "email": "owner@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "4150", "name": "Owen Owner"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "4150", "formsOfAddress": "he/him"}'
event 'api/areas/add-owner' '{"areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "memberNumber": "4150"}'
event 'api/areas/add-owner' '{"areaId": "aaaaaaaa-0000-4000-8000-000000000001", "memberNumber": "4150"}'
event 'api/areas/add-owner' '{"areaId": "aaaaaaaa-0000-4000-8000-000000000004", "memberNumber": "4150"}'
event 'api/areas/add-owner' '{"areaId": "aaaaaaaa-0000-4000-8000-000000000006", "memberNumber": "4150"}'

# Treacle Trainer (Trainer for metal lathe)
event 'api/members/create' '{"memberNumber": "7777", "email": "trainer@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "7777", "name": "Treacle Trainer"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "7777", "formsOfAddress": "they/them"}'
event 'api/equipment/mark-member-trained' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "7777"}'
event 'api/areas/add-owner' '{"areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "memberNumber": "7777"}'
event 'api/equipment/add-trainer' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "7777"}'

# Lucy Lathe (Trained on Lathe)
event 'api/members/create' '{"memberNumber": "8888", "email": "lathe@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "8888", "name": "Lucy Lathe"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "8888", "formsOfAddress": "Queen of turns"}'
event 'api/equipment/mark-member-trained' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "memberNumber": "8888"}'

# Neon Newmember (has completed the lathe training sheet)
event 'api/members/create' '{"memberNumber": "9999", "email": "new@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "9999", "name": "Neon Newmember"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "9999", "formsOfAddress": "So bright!"}'

# foo@example.com
event 'api/members/create' '{"memberNumber": "1234", "email": "foo@example.com"}'

# Mixed-case local part (for testing case-insensitive email login, issue #260)
# Stored as "Joe@example.com"; logging in with "joe@example.com" should still work.
event 'api/members/create' '{"memberNumber": "4321", "email": "Joe@example.com"}'

# --- Trouble tickets ---
# "Metal Lathe" resolves to the seeded equipment; "3D Printer" has no match so its
# ticket lands in the Unassigned bucket. We create each ticket then drive it to a
# status so the board shows a spread of states.

# Todo (stays as raised)
event 'api/trouble-tickets/create' '{"id": "11111111-1111-1111-1111-111111111111", "submittedEquipment": "Metal Lathe", "submittedMemberNumber": "8888", "submittedEmail": "lathe@example.com", "submittedName": "Lucy Lathe", "otherEquipmentDetail": "", "status": "It is making a grinding noise", "attempting": "Facing a steel bar", "issue": "Loud grinding from the headstock under load", "steps": "Reduced speed and depth of cut, noise persisted"}'

# Resolved
event 'api/trouble-tickets/create' '{"id": "22222222-2222-2222-2222-222222222222", "submittedEquipment": "Metal Lathe", "submittedMemberNumber": "9999", "submittedEmail": "new@example.com", "submittedName": "Neon Newmember", "otherEquipmentDetail": "", "status": "Chuck was stuck", "attempting": "Changing the chuck", "issue": "Chuck key would not turn", "steps": "Applied penetrating oil"}'
event 'api/trouble-tickets/resolve' '{"ticketId": "22222222-2222-2222-2222-222222222222", "summary": "Freed the chuck jaws and re-greased them"}'

# Parked
event 'api/trouble-tickets/create' '{"id": "33333333-3333-3333-3333-333333333333", "submittedEquipment": "Metal Lathe", "submittedMemberNumber": "8888", "submittedEmail": "lathe@example.com", "submittedName": "Lucy Lathe", "otherEquipmentDetail": "", "status": "Worn drive belt", "attempting": "General turning", "issue": "Belt slips under load", "steps": "Tensioned the belt, still slips"}'
event 'api/trouble-tickets/park' '{"ticketId": "33333333-3333-3333-3333-333333333333", "whyParked": "Replacement belt not in stock", "pathToResolution": "Order belt part #A-1234 and refit", "intermediateActions": "Tag the lathe as out of service until the belt arrives"}'

# Needs Help
event 'api/trouble-tickets/create' '{"id": "44444444-4444-4444-4444-444444444444", "submittedEquipment": "Metal Lathe", "submittedMemberNumber": "9999", "submittedEmail": "new@example.com", "submittedName": "Neon Newmember", "otherEquipmentDetail": "", "status": "Motor will not start", "attempting": "Switching the machine on", "issue": "No response from the motor", "steps": "Checked the e-stop and the plug"}'
event 'api/trouble-tickets/needs-help' '{"ticketId": "44444444-4444-4444-4444-444444444444", "whatTried": "Reseated the drive belt and checked the motor wiring", "whyDidntWork": "Motor still does not spin - suspect the controller board"}'

# Unassigned (equipment name has no matching record)
event 'api/trouble-tickets/create' '{"id": "55555555-5555-5555-5555-555555555555", "submittedEquipment": "3D Printer", "submittedMemberNumber": "1234", "submittedEmail": "foo@example.com", "submittedName": null, "otherEquipmentDetail": "Printer two", "status": "Working but not configured", "attempting": "Printing a small model", "issue": "AMS sync stuck loading", "steps": "Retried connecting to the printer and AMS"}'
