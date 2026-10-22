import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {PenceFromPoundsString} from '../types/money';

// The proposal a purchase request carries when it needs one: the need;
// optionally the options considered (each with pros, cons and cost) and the
// one preferred - a proposal is more likely to be accepted with them; a risk
// assessment with remedial actions (only when it presents a moderate
// to high health and safety risk), and - where they apply - where it goes,
// who owns it and how it'll be trained for and serviced. Read by the submit
// command and by the form, so both accept and refuse the same things.

// Posted as proposal[need], proposal[options][0][pros] etc. Express reads
// each list as an array - or as an object keyed by index once there are more
// than 20.
const indexed = <C extends t.Mixed>(codec: C) =>
  t.union([t.readonlyArray(codec), t.record(t.string, codec)]);

const RawOption = t.partial({
  description: t.string,
  pros: t.string,
  cons: t.string,
  // In pounds, e.g. "630.00".
  cost: t.string,
});

// Severity and probability are rated 1 to 5, before and after the remedial
// actions, as on a standard risk matrix.
const RawRisk = t.partial({
  hazard: t.string,
  harm: t.string,
  severity: t.string,
  probability: t.string,
  actions: t.string,
  residualSeverity: t.string,
  residualProbability: t.string,
});

export const RawProposal = t.partial({
  need: t.string,
  options: indexed(RawOption),
  preferred: t.string,
  risks: indexed(RawRisk),
  location: t.string,
  owner: t.string,
  training: t.string,
});

// As recorded on the PurchaseRequestSubmitted event and kept in the read
// model.
const ProposalOptionCodec = t.strict({
  description: t.string,
  pros: t.string,
  cons: t.string,
  costPence: t.number,
});

// The 1 to 5 scales for a risk, as on a standard risk matrix.
export const SEVERITY_SCALE = [
  'Negligible',
  'Minor',
  'Moderate',
  'Major',
  'Severe',
] as const;
export const PROBABILITY_SCALE = [
  'Rare',
  'Unlikely',
  'Possible',
  'Likely',
  'Almost certain',
] as const;

// 1 (least) to 5 (most).
const Rating = t.refinement(
  t.number,
  rating => Number.isInteger(rating) && rating >= 1 && rating <= 5,
  'Rating'
);

const ProposalRiskCodec = t.strict({
  hazard: t.string,
  // Who or what could be harmed, and how: the user, people nearby,
  // equipment, the building
  harm: t.string,
  // If it goes wrong, how bad; and how likely it is - before the actions
  severity: Rating,
  probability: Rating,
  // What will be done to reduce the probability and severity
  actions: t.string,
  // The same ratings once the actions are in place
  residualSeverity: Rating,
  residualProbability: Rating,
});

const optionalText = t.union([t.string, t.null]);

export const ProposalCodec = t.strict({
  need: t.string,
  // Optional: none, if they chose not to compare options.
  options: t.readonlyArray(ProposalOptionCodec),
  preferred: optionalText,
  // Empty unless it presents a moderate to high health and safety risk.
  risks: t.readonlyArray(ProposalRiskCodec),
  location: optionalText,
  owner: optionalText,
  trainingAndServicing: optionalText,
});

export type Proposal = t.TypeOf<typeof ProposalCodec>;
export type ProposalOption = t.TypeOf<typeof ProposalOptionCodec>;
export type ProposalRisk = t.TypeOf<typeof ProposalRiskCodec>;

export type TypedRisk = {
  hazard: string;
  harm: string;
  severity: string;
  probability: string;
  actions: string;
  residualSeverity: string;
  residualProbability: string;
};

// As typed, for showing back in the form: lists in order, entirely blank
// entries left out.
export type TypedProposal = {
  need: string;
  options: ReadonlyArray<{
    description: string;
    pros: string;
    cons: string;
    cost: string;
  }>;
  preferred: string;
  risks: ReadonlyArray<TypedRisk>;
  location: string;
  owner: string;
  training: string;
};

const inOrder = <A>(
  raw: ReadonlyArray<A> | Record<string, A> | undefined
): ReadonlyArray<A> =>
  raw === undefined
    ? []
    : Array.isArray(raw)
      ? (raw as ReadonlyArray<A>)
      : Object.entries(raw)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, entry]) => entry);

const someText = (values: ReadonlyArray<string>) =>
  values.some(value => value.trim() !== '');

export const typedProposal = (
  raw: t.TypeOf<typeof RawProposal> | undefined
): TypedProposal => ({
  need: raw?.need ?? '',
  options: inOrder(raw?.options)
    .map(option => ({
      description: option.description ?? '',
      pros: option.pros ?? '',
      cons: option.cons ?? '',
      cost: option.cost ?? '',
    }))
    .filter(option =>
      someText([option.description, option.pros, option.cons, option.cost])
    ),
  preferred: raw?.preferred ?? '',
  risks: inOrder(raw?.risks)
    .map(risk => ({
      hazard: risk.hazard ?? '',
      harm: risk.harm ?? '',
      severity: risk.severity ?? '',
      probability: risk.probability ?? '',
      actions: risk.actions ?? '',
      residualSeverity: risk.residualSeverity ?? '',
      residualProbability: risk.residualProbability ?? '',
    }))
    .filter(risk =>
      someText([
        risk.hazard,
        risk.harm,
        risk.severity,
        risk.probability,
        risk.actions,
        risk.residualSeverity,
        risk.residualProbability,
      ])
    ),
  location: raw?.location ?? '',
  owner: raw?.owner ?? '',
  training: raw?.training ?? '',
});

const required = (value: string, message: string) =>
  value.trim() === '' ? E.left(message) : E.right(value.trim());

const optional = (value: string) =>
  value.trim() === '' ? null : value.trim();

const normaliseOption = (
  option: TypedProposal['options'][number],
  index: number
): E.Either<string, ProposalOption> => {
  const where = `Option ${index + 1}`;
  return pipe(
    E.Do,
    E.bind('description', () =>
      required(option.description, `${where}: please describe the option.`)
    ),
    E.bind('costPence', () =>
      option.cost.trim() === ''
        ? E.left(`${where}: please say what it would cost.`)
        : pipe(
            PenceFromPoundsString.decode(option.cost),
            E.mapLeft(
              () => `${where}: the cost should be in pounds, e.g. 630.00.`
            )
          )
    ),
    E.map(({description, costPence}) => ({
      description,
      pros: option.pros.trim(),
      cons: option.cons.trim(),
      costPence,
    }))
  );
};

const rating = (value: string, message: string): E.Either<string, number> =>
  /^[1-5]$/.test(value.trim()) ? E.right(Number(value.trim())) : E.left(message);

const normaliseRisk = (
  risk: TypedRisk,
  index: number
): E.Either<string, ProposalRisk> => {
  const where = `Risk ${index + 1}`;
  return pipe(
    E.Do,
    E.bind('hazard', () =>
      required(risk.hazard, `${where}: please say what the hazard is.`)
    ),
    E.bind('severity', () =>
      rating(
        risk.severity,
        `${where}: please rate how bad it would be, from 1 to 5.`
      )
    ),
    E.bind('probability', () =>
      rating(
        risk.probability,
        `${where}: please rate how likely it is, from 1 to 5.`
      )
    ),
    E.bind('actions', () =>
      required(
        risk.actions,
        `${where}: please say what will be done to reduce the risk.`
      )
    ),
    E.bind('residualSeverity', () =>
      rating(
        risk.residualSeverity,
        `${where}: please rate how bad it would be once those actions are taken, from 1 to 5.`
      )
    ),
    E.bind('residualProbability', () =>
      rating(
        risk.residualProbability,
        `${where}: please rate how likely it would be once those actions are taken, from 1 to 5.`
      )
    ),
    E.map(fields => ({...fields, harm: risk.harm.trim()}))
  );
};

// The need is always needed, and a risk assessment when it presents a
// moderate to high health and safety risk (it's left out otherwise). Options
// and the preferred one are optional, but any option given needs a
// description and a cost. The first problem is reported.
export const normaliseProposal = (
  proposal: TypedProposal,
  needsRiskAssessment: boolean
): E.Either<string, Proposal> =>
  pipe(
    E.Do,
    E.bind('need', () =>
      required(proposal.need, 'Proposal: please describe the need.')
    ),
    E.bind('options', () =>
      pipe(
        proposal.options,
        E.traverseArrayWithIndex((index, option) =>
          normaliseOption(option, index)
        )
      )
    ),
    E.let('preferred', () => optional(proposal.preferred)),
    E.bind('risks', () =>
      !needsRiskAssessment
        ? E.right([])
        : proposal.risks.length === 0
          ? E.left(
              'Proposal: please assess the health and safety risks, with what will be done about each.'
            )
          : pipe(proposal.risks, E.traverseArrayWithIndex((index, risk) =>
              normaliseRisk(risk, index)
            ))
    ),
    E.map(({need, options, preferred, risks}) => ({
      need,
      options,
      preferred,
      risks,
      location: optional(proposal.location),
      owner: optional(proposal.owner),
      trainingAndServicing: optional(proposal.training),
    }))
  );
