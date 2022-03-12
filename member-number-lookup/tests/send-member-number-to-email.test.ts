describe('send-member-number-to-email', () => {
  describe('when the email can be uniquely linked to a member number', () => {
    it.todo('tries to send an email with the number');
  });

  describe('when the email is used by multiple member numbers', () => {
    it.todo('does not send any emails');
    it.todo('logs an error');
  });

  describe('when the submitted email has different capitalisation from one that can be uniquely linked to a member number', () => {
    it.todo('tries to send an email with the number');
  });

  describe('when database query fails', () => {
    it.todo('logs an error');
  });

  describe('when email fails to send', () => {
    it.todo('logs an error');
  });
});
