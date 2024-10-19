import {ViewModel} from './view-model';
import {Actor} from '../../types/actor';
import {escapeCsv} from '../../csv';

const renderActor = (actor: Actor) => {
  switch (actor.tag) {
    case 'system':
      return 'system';
    case 'token':
      return 'api';
    case 'user':
      return actor.user.emailAddress;
  }
};

export const render = (viewModel: ViewModel) => {
  const ownerData = [
    '',
    'Owners',
    '',
    'area_id,area_name,member_number,email,name,ownerSince,markedOwnerBy',
  ];
  const trainerData = [
    '',
    'Trainers',
    '',
    'area_id,area_name,equipment_id,equipment_name,member_number,email,name,trainerSince,markedTrainerBy',
  ];
  const trainedData = [
    '',
    'Trained Members',
    '',
    'area_id,area_name,equipment_id,equipment_name,member_number,email,name,trainedSince,markedTrainedBy',
  ];
  for (const {area, owners, byEquipment} of viewModel.byAreaByEquipment) {
    owners.map(owner =>
      ownerData.push(
        [
          area.area_id,
          area.area_name,
          owner.memberNumber,
          owner.email,
          owner.name,
          owner.ownerSince.toISOString(),
          renderActor(owner.markedOwnerBy),
        ]
          .map(escapeCsv)
          .join(',')
      )
    );
    for (const {equipment, trainers, trainedMembers} of byEquipment) {
      trainers.map(trainer =>
        trainerData.push(
          [
            area.area_id,
            area.area_name,
            equipment.equipment_id,
            equipment.equipment_name,
            trainer.memberNumber,
            trainer.email,
            trainer.name,
            trainer.trainerSince.toISOString(),
            renderActor(trainer.markedTrainerBy),
          ]
            .map(escapeCsv)
            .join(',')
        )
      );
      trainedMembers.map(trained =>
        trainedData.push(
          [
            area.area_id,
            area.area_name,
            equipment.equipment_id,
            equipment.equipment_name,
            trained.memberNumber,
            trained.email,
            trained.name,
            trained.trainedSince.toISOString(),
            renderActor(trained.markedTrainedBy),
          ]
            .map(escapeCsv)
            .join(',')
        )
      );
    }
  }
  return ownerData
    .join('\n')
    .concat(trainerData.join('\n'))
    .concat(trainedData.join('\n'));
};
