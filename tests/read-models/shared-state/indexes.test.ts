import {TestFramework, initTestFramework} from '../test-framework';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';
import {sql} from 'drizzle-orm';
import {EmailAddress} from '../../../src/types';

// The read model's query paths assume indexes on the lookup columns (SQLite
// does not index foreign keys automatically), and the read model builds its
// schema from raw SQL rather than drizzle metadata. A test that only checked
// names would pass with the right name over the wrong columns, so these
// assert the ordered column definitions, and that representative page queries
// actually plan through the indexes rather than scanning.
describe('read model indexes', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const indexColumns = (index: string): ReadonlyArray<string> =>
    framework.sharedReadModel.readOnlyDb
      .all<{name: string}>(sql.raw(`PRAGMA index_info(${index})`))
      .map(row => row.name);

  const planDetails = (sqlText: string): ReadonlyArray<string> =>
    framework.sharedReadModel.readOnlyDb
      .all<{detail: string}>(sql.raw(`EXPLAIN QUERY PLAN ${sqlText}`))
      .map(row => row.detail);

  it('defines the member and areas lookup indexes over the columns the pages filter on', () => {
    expect(indexColumns('memberNumbers_userId_idx')).toEqual([
      'userId',
      'memberNumber',
    ]);
    expect(indexColumns('memberEmails_userId_addedAt_idx')).toEqual([
      'userId',
      'addedAt',
    ]);
    expect(indexColumns('trainedMembers_userId_idx')).toEqual(['userId']);
    expect(indexColumns('trainedMembers_equipmentId_trainedAt_idx')).toEqual([
      'equipmentId',
      'trainedAt',
    ]);
    expect(indexColumns('trainedMembers_trainedByMemberNumber_idx')).toEqual([
      'trainedByMemberNumber',
    ]);
    expect(indexColumns('trainers_equipmentId_idx')).toEqual(['equipmentId']);
    expect(indexColumns('owners_userId_idx')).toEqual(['userId']);
    expect(indexColumns('owners_areaId_idx')).toEqual(['areaId']);
    expect(indexColumns('equipment_areaId_idx')).toEqual(['areaId']);
  });

  it('plans member-page lookups through the indexes, not table scans', () => {
    // The shapes members.getByMemberNumber and area expansion issue.
    const plans = [
      ...planDetails(
        "SELECT memberNumber FROM memberNumbers WHERE userId = 'no-such-user' ORDER BY memberNumber DESC"
      ),
      ...planDetails(
        "SELECT id FROM equipment WHERE areaId = 'no-such-area'"
      ),
      ...planDetails(
        'SELECT trainedAt FROM trainedMembers WHERE equipmentId = \'no-such-machine\' ORDER BY trainedAt'
      ),
    ].join('; ');
    expect(plans).toContain('SEARCH');
    expect(plans).not.toContain('SCAN');
  });

  it('still projects and reads members after indexing', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 1,
      email: 'indexed@example.com' as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    expect(
      pipe(
        1,
        framework.sharedReadModel.members.getByMemberNumber,
        getSomeOrFail,
        member => member.memberNumber
      )
    ).toBe(1);
  });
});
