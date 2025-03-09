import {ViewModel} from './view-model';

export const renderJson = (viewModel: ViewModel) =>
  JSON.stringify(viewModel.jsonDump);

export const renderBuffer = (viewModel: ViewModel) =>
  viewModel.bufferDump.toString('base64');
