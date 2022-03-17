describe('rate-limit-sending-of-emails', () => {
  describe('when the recipient has not been sent any emails yet', () => {
    it.todo('returns the input email on the Right');
  });

  describe('when the recipient has been sent less than the limit of emails in the past 24h', () => {
    it.todo('returns the input email on the Right');
  });

  describe('when the recipient has already been sent the limit of emails in the past 24h', () => {
    it.todo('returns on Left');
  });

  describe('when the recipient was sent the limit of emails in the past, but not in the current 24h', () => {
    it.todo('returns the input email on the Right');
  });
});
