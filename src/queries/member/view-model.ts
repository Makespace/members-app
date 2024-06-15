type Member = {
  email: string;
  memberNumber: number;
};

export type ViewModel = {
  member: Readonly<Member>;
  isSelf: boolean;
};
