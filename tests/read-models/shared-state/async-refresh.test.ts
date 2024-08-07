describe('async-refresh', () => {
  describe('when the read model is empty', () => {
    it.todo('creates the necessary tables');
    it.todo('processes all events');
  });

  describe('when the read model is up to date', () => {
    it.todo('does nothing');
  });

  describe("when new events exist that haven't been processed by the read model", () => {
    it.todo('only processes the new events');
  });
});
