
export interface VotePdfParsed {
  sequence: number;
  sessionDay: number;
  title: string;
  date: string;
  time: string;
  headers: { name: string; value: string | number | boolean | null }[];
  legand: string[];
  votes: VoteInfo[];
  errors: string[];
}

export interface VoteInfo {
  name: string;
  areaId: number;
  vote: VoteValue;
}

export enum VoteValue {
  YEA = "Y",
  NAY = "N",
  EXCUSED = "EX",
  ABSTAIN = "AV",
  NOT_VOTING = "-NV-",
}