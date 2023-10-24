
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
  billUrl?: string;
  billPdf?: string;
  billHistory: {
    date: string;
    chamber: string;
    action: string;
    [index: string]: string;
  }[];
  billText: {
    version: string;
    posted: string;
    format?: string;
    linkUrl?: string;
    linkPdf?: string;
    [index: string]: string | undefined;
  }[];
  citations: ({
    citation: { link: string; text: string; rawHtml: string };
    catchline: string;
    locationInBill: { link: string; text: string; rawHtml: string; fileType: string | null }[];
  } | {
    chapterLaw: { link: string; text: string; rawHtml: string };
    sectionAmended: string;
    locationInBill: { link: string; text: string; rawHtml: string; fileType: string | null }[];
  })[];
  relatedBills: {
    billLink: string;
    subject: string;
    filedBy: string;
    relationship: string;
    lastActionAndLocation: string;
    [index: string]: string;
  }[];
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