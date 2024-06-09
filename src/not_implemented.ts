// Swallow unused stuff so unimplemented stuff doesn't fail eslint on main branch.
// Will remove before CD is implemented.

export const notImplemented = (_args: any[]): never => { // eslint-disable-line
  throw new Error('Not implemented.');
};
export const notImplementedA = async (_args: any[]): Promise<never> => { // eslint-disable-line
  throw new Error('Not implemented.');
};
