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
