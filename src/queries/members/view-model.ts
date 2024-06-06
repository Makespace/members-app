type Member = {
  email: string;
  memberNumber: number;
};

export type ViewModel = {
  members: ReadonlyArray<Member>;
};
