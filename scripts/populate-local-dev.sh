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

# Metal lathe
event 'api/equipment/add' '{"id": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "name": "Metal Lathe", "areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e"}'
event 'api/equipment/add-training-sheet' '{"equipmentId": "4224ee94-09b0-47d4-ae60-fac46b8ca93e", "trainingSheetId": "19e610we8nSzo3QO-T76RzdVoCNjq75my4Fkc0eDgmSo"}'

# Ada Admin (superuser)
event 'api/members/create' '{"memberNumber": "1337", "email": "admin@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "1337", "name": "Ada Admin"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "1337", "formsOfAddress": "she/her"}'
event 'api/super-users/declare' '{"memberNumber": "1337"}'

# Owen Owner (owner of metal shop area)
event 'api/members/create' '{"memberNumber": "4150", "email": "owner@example.com"}'
event 'api/members/edit-name' '{"memberNumber": "4150", "name": "Owen Owner"}'
event 'api/members/edit-forms-of-address' '{"memberNumber": "4150", "formsOfAddress": "he/him"}'
event 'api/areas/add-owner' '{"areaId": "eeaf7f8b-77a3-429d-ae9d-2f7ade53736e", "memberNumber": "4150"}'

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

# Trouble tickets (fixed ids so re-running the script is idempotent)
# One resolves to the Metal Lathe, one is Unassigned (unknown equipment).
event 'api/trouble-tickets/create' '{"id": "7c1f9a30-45c2-4b6e-9a11-2f8a5f0d3c21", "submittedEquipment": "Metal Lathe", "submittedMemberNumber": "8888", "submittedEmail": "lathe@example.com", "submittedName": "Lucy Lathe", "otherEquipmentDetail": "", "status": "Making bad noises", "attempting": "Turning a chair leg", "issue": "Loud grinding noise from the headstock", "steps": "Stopped the machine and cleaned the chuck"}'
event 'api/trouble-tickets/create' '{"id": "b4e2d7f8-9c13-4a5b-8d6e-1f2a3b4c5d6f", "submittedEquipment": "Mystery Machine", "submittedMemberNumber": null, "submittedEmail": "new@example.com", "submittedName": "Neon Newmember", "otherEquipmentDetail": "The one in the corner", "status": "Dead", "attempting": "Switching it on", "issue": "No power at all", "steps": "Checked the fuse"}'

# Purchasing areas (budget-holding groups of areas), with some spend this year
# so the request form's budget bar has something to show. Ada Admin owns an
# area in each and is a purchaser for both (as a super user she could submit
# anyway). Fixed ids, so re-running is a no-op.
event 'api/areas/create' '{"id": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a01", "name": "Wood Shop"}'
event 'api/areas/create' '{"id": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a02", "name": "Craft Room"}'
event 'api/areas/create' '{"id": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a03", "name": "Art Space"}'
event 'api/areas/add-owner' '{"areaId": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a01", "memberNumber": "1337"}'
event 'api/areas/add-owner' '{"areaId": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a02", "memberNumber": "1337"}'

event 'api/purchasing-areas/create' '{"id": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e01", "name": "Wood Shop", "yearlyBudget": "1000"}'
event 'api/purchasing-areas/assign-area' '{"purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e01", "areaId": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a01"}'
event 'api/purchasing-areas/add-purchaser' '{"purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e01", "memberNumber": "1337"}'

event 'api/purchasing-areas/create' '{"id": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "name": "Craft & Art", "yearlyBudget": "1000"}'
event 'api/purchasing-areas/assign-area' '{"purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "areaId": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a02"}'
event 'api/purchasing-areas/assign-area' '{"purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "areaId": "5b0c8a52-2f5e-4d39-9a51-6f1e0c2d7a03"}'
event 'api/purchasing-areas/add-purchaser' '{"purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "memberNumber": "1337"}'

# Prior requests, recorded through the API on Ada's behalf: £420 spent from
# the Wood Shop budget and £880 from Craft & Art's, plus a consumable that
# doesn't count against it.
event 'api/purchase-requests/submit' '{"id": "c3a1e2f4-6b7d-4e8f-9a0b-1c2d3e4f5a01", "purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e01", "submittedByMemberNumber": "1337", "isMemberPaidConsumable": "false", "summary": "Planer-thicknesser repair", "purchases": [{"shop": "axminstertools.com", "delivery": "", "items": [{"url": "https://www.axminstertools.com/", "sku": "", "quantity": "1", "price": "380", "notes": "Replacement planer blade set"}, {"url": "", "sku": "", "quantity": "1", "price": "40", "notes": "Drive belt"}]}], "justification": "The planer has been out of action since the belt snapped."}'
event 'api/purchase-requests/submit' '{"id": "c3a1e2f4-6b7d-4e8f-9a0b-1c2d3e4f5a02", "purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "submittedByMemberNumber": "1337", "isMemberPaidConsumable": "false", "summary": "Sewing machine", "purchases": [{"shop": "Sewing Direct", "delivery": "", "items": [{"url": "", "sku": "", "quantity": "1", "price": "600", "notes": "Heavy-duty sewing machine"}]}], "justification": "The old machine cannot cope with canvas."}'
event 'api/purchase-requests/submit' '{"id": "c3a1e2f4-6b7d-4e8f-9a0b-1c2d3e4f5a03", "purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "submittedByMemberNumber": "1337", "isMemberPaidConsumable": "false", "summary": "Easels", "purchases": [{"shop": "Cass Art", "delivery": "", "items": [{"url": "", "sku": "", "quantity": "4", "price": "70", "notes": "Studio easel"}]}], "justification": "For the life drawing group."}'
event 'api/purchase-requests/submit' '{"id": "c3a1e2f4-6b7d-4e8f-9a0b-1c2d3e4f5a04", "purchasingAreaId": "8d4f6e10-3a7b-4c2d-b5e9-1a2b3c4d5e02", "submittedByMemberNumber": "1337", "isMemberPaidConsumable": "true", "summary": "Embroidery thread", "purchases": [{"shop": "Hobbycraft", "delivery": "", "items": [{"url": "", "sku": "", "quantity": "1", "price": "45", "notes": "Thread assortment"}]}], "justification": "Sold to members on SumUp."}'
