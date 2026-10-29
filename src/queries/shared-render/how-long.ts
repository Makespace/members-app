// "3 days", "5 weeks", "4 months": how long, said the way people say it.
export const howLong = (since: Date, now: Date): string => {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000))
  );
  const say = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? '' : 's'}`;
  return days < 14
    ? say(days, 'day')
    : days < 9 * 7
      ? say(Math.floor(days / 7), 'week')
      : say(Math.floor(days / 30), 'month');
};
