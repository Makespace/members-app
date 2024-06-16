import {editName} from './edit-name';
import {editNameForm} from './edit-name-form';
import {editPronouns} from './edit-pronouns';
import {editPronounsForm} from './edit-pronouns-form';

export const members = {
  editName: {
    ...editName,
    ...editNameForm,
  },
  editPronouns: {
    ...editPronouns,
    ...editPronounsForm,
  },
};
