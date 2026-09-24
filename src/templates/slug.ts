// Equipment and areas are identified in URLs by a readable slug rather than a
// uuid, because these URLs are printed on signs: someone can read one off a
// poster, and a half-scanned code is still recoverable by typing.
//
// Slugs are derived from names rather than stored. There is no command to
// rename equipment, so a printed slug stays valid; uuids also keep working,
// so nothing already printed can break.
export const toSlug = (value: string): string =>
  value
    .normalize('NFKD')
    // Drop accents rather than percent-encoding them into noise.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// An area's slug prefixes its equipment, so two areas can each have a
// "Band Saw" without colliding: wood-shop-band-saw, metal-shop-band-saw.
export const equipmentSlug = (areaName: string, equipmentName: string) =>
  [toSlug(areaName), toSlug(equipmentName)].filter(part => part !== '').join('-');

// Two systems rarely punctuate a name the same way: the equipment site files
// "Hammer A3-31 Planer/Thicknesser" as planerthicknesser, dropping the
// slash, where this app's slug would keep it as a separator. Comparing only
// the letters and digits matches them without loosening what a slug is.
export const slugMatches = (a: string, b: string): boolean => {
  const bare = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return toSlug(a) === toSlug(b) || bare(a) === bare(b);
};
