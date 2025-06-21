import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';

import {Dependencies} from '../../dependencies';
import {SheetDataTable} from '../../sync-worker/google/sheet-data-table';
import {pipe} from 'fp-ts/lib/function';
import {Equipment, MemberCoreInfo} from '../shared-state/return-types';

export type EquipmentQuizResults = {
  passedQuizes: SheetDataTable['rows'];
  failedQuizes: SheetDataTable['rows'];
  lastQuizSync: O.Option<Date>;
};

export type OrphanedPassedQuiz = {
  waitingSince: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

export type MemberAwaitingTraining = Pick<
  MemberCoreInfo,
  'memberNumber' | 'name' | 'pastMemberNumbers'
> & {
  waitingSince: Date;
};

const extractPassedQuizes = (
  sheetData: SheetDataTable['rows']
): SheetDataTable['rows'] =>
  pipe(
    sheetData,
    RA.filter(row => row.percentage === 100)
  );

const extractFailedQuizes = (
  sheetData: SheetDataTable['rows']
): SheetDataTable['rows'] =>
  pipe(
    sheetData,
    RA.filter(row => row.percentage < 100)
  );

const getQuizResults = (
  deps: Pick<Dependencies, 'lastQuizSync' | 'getSheetData'>,
  sheetId: string,
  _skip: ReadonlyArray<
    Pick<MemberCoreInfo, 'memberNumber' | 'pastMemberNumbers' | 'emailAddress'>
  >
): TE.TaskEither<string, EquipmentQuizResults> => {
  return pipe(
    TE.Do,
    TE.apS('lastQuizSync', deps.lastQuizSync(sheetId)),
    TE.bind('sheetData', () =>
      deps.getSheetData(
        sheetId
        // skip.flatMap(allMemberNumbers),
        // skip.map(m => m.emailAddress)
      )
    ),
    TE.let('passedQuizes', ({sheetData}) => extractPassedQuizes(sheetData)),
    TE.let('failedQuizes', ({sheetData}) => extractFailedQuizes(sheetData))
  );
};

export type FullQuizResults = {
  lastQuizSync: O.Option<Date>;
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  unknownMembersAwaitingTraining: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizes: SheetDataTable['rows'];
};

export const getFullQuizResults = (
  deps: Pick<Dependencies, 'sharedReadModel' | 'lastQuizSync' | 'getSheetData'>,
  sheetId: string,
  equipment: Equipment
): TE.TaskEither<string, FullQuizResults> =>
  pipe(
    getQuizResults(deps, sheetId, equipment.trainedMembers),
    TE.map(qr => {
      const membersAwaitingTraining: MemberAwaitingTraining[] = [];
      const unknownMembersAwaitingTraining: OrphanedPassedQuiz[] = [];

      for (const row of qr.passedQuizes) {
        if (!row.member_number_provided) {
          continue;
        }
        if (
          equipment.trainedMembers
            .map(m => m.memberNumber)
            .includes(row.member_number_provided)
        ) {
          continue;
        }
        const member = deps.sharedReadModel.members.get(
          row.member_number_provided
        );
        if (O.isNone(member)) {
          unknownMembersAwaitingTraining.push({
            waitingSince: row.response_submitted,
            memberNumberProvided: O.fromNullable(row.member_number_provided),
            emailProvided: O.fromNullable(row.email_provided),
          });
          continue;
        }
        membersAwaitingTraining.push({
          ...member.value,
          waitingSince: row.response_submitted,
        });
      }

      return {
        lastQuizSync: qr.lastQuizSync,
        failedQuizes: qr.failedQuizes,
        membersAwaitingTraining,
        unknownMembersAwaitingTraining,
      };
    })
  );
