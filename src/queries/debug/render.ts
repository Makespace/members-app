import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) => JSON.stringify(viewModel.dump);
