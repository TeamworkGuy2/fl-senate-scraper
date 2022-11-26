
export interface BillAndVotesParsed extends Omit<BillInfo, "votes"> {
  errors: any[];
  votes: VotePdfParsed[];
}

export interface BillInfo {
  title: string | null;
  summary: string[];
  effectiveDate: Date | null;
  lastActionDate: Date | null;
  committees: string[];
  billId: string;
  billUrl: string;
  billPdf: string;
  votes: {
    yeas: number | null;
    nays: number | null;
    link: string;
    chamber: "Senate" | "House" | null;
    date: string | null;
  }[];
}

export interface VotePdfParsed {
  billId: string;
  link: string;
  chamber: "Senate" | "House" | null;
  headers: { name: string; value: string | number | boolean | null }[];
  votes: VoteInfo[];
  errors: string[];
}

export interface VoteInfo {
  areaId: number;
  voterName: string;
  vote: VoteValue;
}

export enum VoteValue {
  YEA = "Y",
  NAY = "N",
  EXCUSED = "EX",
  ABSTAIN = "AV",
  NOT_VOTING = "-NV-",
}