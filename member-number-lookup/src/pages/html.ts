export const html = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<string | number>
): string => {
  let result = '';
  for (let index = 0; index < substitutions.length; index++) {
    result += literals[index];
    result += substitutions[index];
  }
  result += literals[substitutions.length + 1];
  return result;
};
