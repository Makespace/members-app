import {QzEvent} from '../../types/qz-event';
import {Equipment} from './return-types';

export const isNewQuizEvents =
  (current: Equipment) =>
  (event: QzEvent): boolean => {
    return false;
  };
