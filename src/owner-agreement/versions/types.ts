import {Html} from '../../types/html';

export type Responsibility = {
  value: string;
  icon: string;
  title: string;
  description: Html;
};

// A page whose responsibilities the member picks from, showing which they're
// interested in. They must pick at least one before moving on.
export type Choices = {
  name: 'equipment' | 'area';
  responsibilities: ReadonlyArray<Responsibility>;
};

export type AgreementPage = {
  label: string;
  body: Html;
  choices?: Choices;
};
