// A mail header writes a sender as "Alice Example <alice@example.com>", or
// as a bare address. The name is what a person scans for; the address is
// what identifies them. Both are taken as written - a header is free text.

export const senderName = (sender: string): string => {
  const named = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(sender);
  return named === null ? sender.trim() : named[1].trim();
};

export const senderAddress = (sender: string): string => {
  const bracketed = /<([^>]+)>/.exec(sender);
  return (bracketed === null ? sender : bracketed[1]).trim();
};
