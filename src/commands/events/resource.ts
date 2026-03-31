export const resource = (input: {eventId: string}) => ({
  id: input.eventId,
  type: 'DeletedEvent',
});
