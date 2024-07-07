import Handlebars, {SafeString} from 'handlebars';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {User, MemberDetails} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from '../equipment/get-equipment-name';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {readModels} from '../../read-models';

type ViewModel = {
  user: User;
  equipmentId: string;
  equipmentName: string;
  members: ReadonlyArray<MemberDetails>;
};

// TODO - Warning if you try and mark a member as trained who hasn't done the quiz (for now we allow this for flexibility).

const RENDER_MARK_MEMBER_TRAINED_TEMPLATE = Handlebars.compile(
  `
    <h1>Mark a member as trained on {{equipmentName}}</h1>
    <form action="/equipment/mark-member-trained" method="post">
      <input
        type="hidden"
        name="equipmentId"
        value="{{equipmentId}}"
      />

      {{> memberInput members }}

      <button type="submit">Confirm</button>
    </form>
  `
);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Member Training Complete',
    O.some(viewModel.user)
  )(new SafeString(RENDER_MARK_MEMBER_TRAINED_TEMPLATE(viewModel)));

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({events, user}) =>
    pipe(
      {user},
      E.right,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(events, equipmentId)
      ),
      E.let('members', () => {
        const memberDetails = readModels.members.getAllDetails(events);
        return [...memberDetails.values()];
      })
    );

export const markMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
