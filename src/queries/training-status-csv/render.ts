import {ViewModel} from './view-model';
import {escapeCsv} from '../../csv';
import * as O from 'fp-ts/Option';
import {renderActor} from '../../types/actor';

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
  for (const {
    owners,
    equipment,
    id: areaId,
    name: areaName,
  } of viewModel.areas) {
    owners.map(owner =>
      ownerData.push(
        [
          areaId,
          areaName,
          owner.memberNumber,
          owner.emailAddress,
          O.getOrElse(() => '')(owner.name),
          owner.ownershipRecordedAt.toISOString(),
          O.isSome(owner.markedOwnerBy)
            ? renderActor(owner.markedOwnerBy.value)
            : '',
        ]
          .map(escapeCsv)
          .join(',')
      )
    );
    for (const {
      id: equipmentId,
      name: equipmentName,
      trainers,
      trainedMembers,
    } of equipment) {
      trainers.map(trainer =>
        trainerData.push(
          [
            areaId,
            areaName,
            equipmentId,
            equipmentName,
            trainer.memberNumber,
            trainer.emailAddress,
            O.getOrElse(() => '')(trainer.name),
            trainer.trainerSince.toISOString(),
            O.isSome(trainer.markedTrainerByActor)
              ? renderActor(trainer.markedTrainerByActor.value)
              : '',
          ]
            .map(escapeCsv)
            .join(',')
        )
      );
      trainedMembers.map(trained =>
        trainedData.push(
          [
            areaId,
            areaName,
            equipmentId,
            equipmentName,
            trained.memberNumber,
            trained.emailAddress,
            O.getOrElse(() => '')(trained.name),
            trained.trainedSince.toISOString(),
            O.isSome(trained.markedTrainedByActor)
              ? renderActor(trained.markedTrainedByActor.value)
              : '',
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
