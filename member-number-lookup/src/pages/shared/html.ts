export const html = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<string | number>
): string => {
  if (literals.length === 1 && substitutions.length === 0) {
    return literals[0];
  }
  let result = '';
  for (let index = 0; index < substitutions.length; index++) {
    result += literals[index];
    result += substitutions[index];
  }
  result += literals[substitutions.length];
  return result;
};
