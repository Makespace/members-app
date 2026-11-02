import * as O from 'fp-ts/Option';

type Machine = {id: string; name: string; guideUrl: O.Option<string>};

// "https://Equipment.makespace.org/metal-shop/metal-lathe/" and the same
// address written any other way are the same page.
const normaliseUrl = (url: string) =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

const words = (text: string): ReadonlyArray<string> =>
  text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

// Which machine a Meetup training is for. A link to the machine's own guide
// page in the description settles it, as trainers paste it in so people can
// do the quiz first. Failing that, the machine whose name appears in full in
// the title, the most specific one when several do ("Metal Lathe" over
// "Lathe"). Two equally good names is a guess, so it is left unmatched rather
// than shown on the wrong machine.
export const matchMeetupTraining = (
  event: {title: string; description: string},
  machines: ReadonlyArray<Machine>
): O.Option<string> => {
  const description = event.description.toLowerCase();
  const byGuide = machines
    .flatMap(machine =>
      O.isSome(machine.guideUrl) && normaliseUrl(machine.guideUrl.value) !== ''
        ? [{id: machine.id, url: normaliseUrl(machine.guideUrl.value)}]
        : []
    )
    .filter(({url}) => description.includes(url))
    .sort((a, b) => b.url.length - a.url.length);
  if (byGuide.length > 0) {
    return O.some(byGuide[0].id);
  }

  const title = new Set(words(event.title));
  const byName = machines
    .map(machine => ({id: machine.id, words: words(machine.name)}))
    .filter(
      machine =>
        machine.words.length > 0 && machine.words.every(word => title.has(word))
    )
    .sort((a, b) => b.words.length - a.words.length);
  if (byName.length === 0) {
    return O.none;
  }
  if (byName.length > 1 && byName[1].words.length === byName[0].words.length) {
    return O.none;
  }
  return O.some(byName[0].id);
};
