/**
 * Adds lot of example events including registering sheets for equipment to simulate
 * a more 'full' / real deployment.
 */

import axios from 'axios';

const ENDPOINT = 'http://localhost:8080';

type USER = {
  memberNumber: string;
  email: string;
  name: string | undefined;
};

const ADMIN: USER = {
  memberNumber: '1337',
  email: 'admin@example.com',
  name: 'Admin <b>HELLO<\\b>',
};
const CONSUMER: typeof ADMIN = {
  memberNumber: '6781',
  email: 'consumer@example.com',
  name: undefined,
};
const FOO: typeof ADMIN = {
  memberNumber: '1234',
  email: 'foo@example.com',
  name: undefined,
};
const FINN: typeof ADMIN = {
  memberNumber: '3222',
  email: 'finn@example.com',
  name: undefined,
};
const SPARKY: typeof ADMIN = {
  memberNumber: '4444',
  email: 'sparky@example.com',
  name: undefined,
};

const WOOD_AREA = {
  id: '0e1b27ee-36e2-4e2c-9163-2e362380ed2c',
  name: 'Wood Area',
  owners: [FOO],
};
const METAL_SHOP: typeof WOOD_AREA = {
  id: 'eeaf7f8b-77a3-429d-ae9d-2f7ade53736e',
  name: 'Metal Shop',
  owners: [FINN, SPARKY],
};

const WOOD_LATHE = {
  id: '3f133f88-c8c8-45f8-abaa-201f574aafaa',
  name: 'Wood Lathe',
  area: WOOD_AREA.id,
  trainingSheet: '1fyEWGyGOYTvMmlMdl58nErFDjubVQBXNRsmQb1td3_c',
  trainers: [FOO],
  trainedUsers: [CONSUMER, FOO, ADMIN],
};

const METAL_LATHE: typeof WOOD_LATHE = {
  id: '4224ee94-09b0-47d4-ae60-fac46b8ca93e',
  name: 'Metal Lathe',
  area: METAL_SHOP.id,
  trainingSheet: '1Yu8TeG9RTqSEu3dxL5wj8uXfeP3xbIgxQZ1ZB9kyFUE',
  trainers: [FINN],
  trainedUsers: [FINN, SPARKY, CONSUMER],
};

const METAL_MILL: typeof WOOD_LATHE = {
  id: '5e65a301-0d74-4376-94b6-e6599ce6b9c1',
  name: 'Metal Mill',
  area: METAL_SHOP.id,
  trainingSheet: '1yulN3ewYS2XpT22joP5HteZ9H9qebvSEcFXQhxPwXlk',
  trainers: [SPARKY],
  trainedUsers: [SPARKY, CONSUMER],
};

const sendPost = (path: string) => (data: unknown) =>
  axios.post(`${ENDPOINT}/${path}`, JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer secret',
    },
  });

const createUser = async (user: typeof ADMIN) => {
  await sendPost('api/members/create')({
    memberNumber: user.memberNumber,
    email: user.email,
  });
  if (user.name) {
    await sendPost('api/members/edit-name')({
      memberNumber: user.memberNumber,
      name: user.name,
    });
  }
};

const createArea = async (area: typeof WOOD_AREA) => {
  await sendPost('api/areas/create')({
    id: area.id,
    name: area.name,
  });
  await Promise.all(
    area.owners.map(owner =>
      sendPost('api/areas/add-owner')({
        areaId: area.id,
        memberNumber: owner.memberNumber,
      })
    )
  );
};
const createEquipment =
  (area: typeof WOOD_AREA) => async (equipment: typeof WOOD_LATHE) => {
    await sendPost('api/equipment/add')({
      id: equipment.id,
      name: equipment.name,
      areaId: area.id,
    });
    await sendPost('api/equipment/add-training-sheet')({
      equipmentId: equipment.id,
      trainingSheetId: equipment.trainingSheet,
    });
    await Promise.all(
      equipment.trainers.map(trainer =>
        sendPost('api/equipment/add-trainer')({
          equipmentId: equipment.id,
          memberNumber: trainer.memberNumber,
        })
      )
    );
    await Promise.all(
      equipment.trainedUsers.map(user =>
        sendPost('api/equipment/mark-member-trained')({
          equipmentId: equipment.id,
          memberNumber: user.memberNumber,
        })
      )
    );
  };

const main = async () => {
  await Promise.all([ADMIN, CONSUMER, FOO, FINN, SPARKY].map(createUser));
  await sendPost('api/super-users/declare')({
    memberNumber: ADMIN.memberNumber,
  });
  await Promise.all([WOOD_AREA, METAL_SHOP].map(createArea));
  await Promise.all([METAL_LATHE, METAL_MILL].map(createEquipment(METAL_SHOP)));
  await Promise.all([WOOD_LATHE].map(createEquipment(WOOD_AREA)));
};

main()
  .then(_ => console.log('Done'))
  .catch(console.error);
