type Member = {
  email: string;
  memberNumber: number;
};

export type ViewModel = {
  viewerIsSuperUser: boolean;
  members: ReadonlyArray<Member>;
};
