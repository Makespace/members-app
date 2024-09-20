import {DomainEvent} from '../../types';

type TrainedInfo = {
  when: Date;
  by: number | null;
  prev: ReadonlyArray<{
    when: Date;
    by: number | null;
  }>;
};

export const getMembersTrainedOn =
  (equipmentId: string) =>
  (events: ReadonlyArray<DomainEvent>): ReadonlyMap<number, TrainedInfo> => {
    // Note that currently you cannot revoke training.

    const trained: Map<number, TrainedInfo> = new Map();
    for (const event of events) {
      if (
        event.type !== 'MemberTrainedOnEquipment' ||
        event.equipmentId !== equipmentId
      ) {
        continue;
      }
      const current = trained.get(event.memberNumber);
      if (current) {
        trained.set(event.memberNumber, {
          when: event.recordedAt,
          by: event.trainedByMemberNumber,
          prev: current.prev.concat([
            {
              when: current.when,
              by: current.by,
            },
          ]),
        });
      }
      trained.set(event.memberNumber, {
        when: event.recordedAt,
        by: event.trainedByMemberNumber,
        prev: [],
      });
    }
    return trained;
  };
