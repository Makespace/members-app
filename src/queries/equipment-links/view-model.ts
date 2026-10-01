import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';

export type EquipmentLinks = {
  id: UUID;
  name: string;
  areaName: string;
  guideUrl: O.Option<string>;
  riskAssessmentUrl: O.Option<string>;
};

export type ViewModel = {
  // Incomplete first: the point of the page is the gaps, not the rows that
  // are already done.
  missing: ReadonlyArray<EquipmentLinks>;
  complete: ReadonlyArray<EquipmentLinks>;
  total: number;
  withGuide: number;
  withRiskAssessment: number;
};
