import {AreaViewModel} from './view-model';

// Areas whose name identifies them as a "Makespace System" rather than a
// physical/equipment area. This is matched by NAME, so it's fragile to renames -
// a data-driven "area category" (e.g. a flag on the area) could replace it later.
const SYSTEM_AREA_NAMES: ReadonlySet<string> = new Set(
  [
    'IT Systems',
    'Audio Visual',
    'PAT Testing',
    'Future of Makespace',
    'First Aiders',
    'Fire Marshals',
    'Member Inductions',
    'Marketing',
    'Events',
  ].map(name => normalise(name))
);

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export const isSystemArea = (name: string): boolean =>
  SYSTEM_AREA_NAMES.has(normalise(name));

type PartitionedAreas = {
  myAreas: ReadonlyArray<AreaViewModel>;
  makespaceAreas: ReadonlyArray<AreaViewModel>;
  systems: ReadonlyArray<AreaViewModel>;
};

// Split the areas into the three page sections: areas the viewer owns, then the
// remaining areas grouped into physical "Makespace Areas" and "Makespace
// Systems". Pure so it can be unit-tested independently of the read model.
export const partitionAreas = (
  areas: ReadonlyArray<AreaViewModel>,
  ownedAreaIds: ReadonlySet<string>
): PartitionedAreas => {
  const myAreas: AreaViewModel[] = [];
  const makespaceAreas: AreaViewModel[] = [];
  const systems: AreaViewModel[] = [];

  for (const area of areas) {
    if (ownedAreaIds.has(area.id)) {
      myAreas.push(area);
    } else if (isSystemArea(area.name)) {
      systems.push(area);
    } else {
      makespaceAreas.push(area);
    }
  }

  return {myAreas, makespaceAreas, systems};
};
