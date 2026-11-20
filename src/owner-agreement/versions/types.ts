import {Html} from '../../types/html';

type Responsibility = {
  value: string;
  icon: string;
  title: string;
  description: Html;
};

// A page whose responsibilities the member picks from, showing which they're
// interested in. They must pick at least one before moving on.
type Choices = {
  name: 'equipment' | 'area';
  responsibilities: ReadonlyArray<Responsibility>;
};

export type AgreementPage = {
  label: string;
  body: Html;
  choices?: Choices;
};

// One change from the previous version, said in a sentence, with snippets of
// the wording before and after where that helps.
type AgreementChange = {
  // Something new in the agreement, or taken out of it; otherwise a change
  // to what was there.
  kind?: 'added' | 'removed';
  // What it's about, when the summary needs it said, e.g. "Training".
  tag?: string;
  summary: Html;
  before?: Html;
  after?: Html;
};

// A summary of what changed from the previous version, grouped by subject.
export type AgreementChanges = {
  // What these changes are measured against, finishing "Changes since …".
  comparedWith: string;
  groups: ReadonlyArray<{
    heading: string;
    changes: ReadonlyArray<AgreementChange>;
  }>;
};
