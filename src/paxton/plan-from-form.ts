import {fieldNames} from './render-preview';

// What a submitted preview asks for, read back out of its flat fields. Each
// entry is still raw strings: the record-fob / remove-fob command codecs do
// the validation so the import cannot accept anything the forms would not.
export type ImportPlan = {
  records: ReadonlyArray<{
    memberNumber: string;
    fobId: string;
    accessLevel: string;
    paxtonName: string;
  }>;
  removals: ReadonlyArray<{memberNumber: string; fobId: string}>;
  // Rows whose member number was left blank.
  skipped: number;
};

const MEMBER_FIELD = /^member-(\d+)$/;
const REMOVE_FIELD = /^remove-(\d+)$/;

const stringField = (body: Record<string, unknown>, name: string): string => {
  const value = body[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const planFromForm = (body: Record<string, unknown>): ImportPlan => {
  const records: Array<ImportPlan['records'][number]> = [];
  const removals: Array<ImportPlan['removals'][number]> = [];
  let skipped = 0;
  for (const key of Object.keys(body)) {
    const record = MEMBER_FIELD.exec(key);
    if (record) {
      const fobId = record[1];
      const memberNumber = stringField(body, key);
      if (memberNumber === '') {
        skipped += 1;
        continue;
      }
      records.push({
        memberNumber,
        fobId,
        accessLevel: stringField(body, fieldNames.level(Number(fobId))),
        paxtonName: stringField(body, fieldNames.name(Number(fobId))),
      });
      continue;
    }
    const remove = REMOVE_FIELD.exec(key);
    if (remove && stringField(body, key) !== '') {
      const fobId = remove[1];
      removals.push({
        memberNumber: stringField(body, fieldNames.removeMember(Number(fobId))),
        fobId,
      });
    }
  }
  return {records, removals, skipped};
};
