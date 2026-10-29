import * as O from 'fp-ts/Option';
import {matchMeetupTraining} from '../../src/training-sessions/meetup-match';

const machine = (id: string, name: string, guideUrl?: string) => ({
  id,
  name,
  guideUrl: O.fromNullable(guideUrl),
});

const machines = [
  machine('lathe', 'Lathe'),
  machine('metal-lathe', 'Metal Lathe'),
  machine(
    'bambu',
    'Bambu Lab X1C',
    'https://equipment.makespace.org/3d-printers/bambu-lab-x1/'
  ),
  machine('mill', 'Metal Mill'),
  machine('mill-2', 'Mill Metal'),
];

const match = (title: string, description = '') =>
  matchMeetupTraining({title, description}, machines);

describe('which machine a Meetup training is for', () => {
  it('goes by the most specific name in the title', () => {
    expect(match('Metal Lathe Training')).toStrictEqual(O.some('metal-lathe'));
    expect(match('Lathe training (members only)')).toStrictEqual(
      O.some('lathe')
    );
  });

  it("prefers a link to the machine's guide, however it is written", () => {
    expect(
      match(
        '3D Printer Training',
        'Do the quiz first [HTTPS://equipment.makespace.org/3d-printers/bambu-lab-x1](https://equipment.makespace.org/3d-printers/bambu-lab-x1)'
      )
    ).toStrictEqual(O.some('bambu'));
  });

  it('leaves it unmatched when two machines fit equally well', () => {
    expect(match("Metal Mill Training 'Qualified Entry'")).toStrictEqual(
      O.none
    );
  });

  it('leaves it unmatched when no machine is named', () => {
    expect(match('First Aid Training')).toStrictEqual(O.none);
  });
});
