import { Pdf2Json } from "./types/pdf2json";
import { VoteInfo, VotePdfParsed, VoteValue } from "./@types";
import * as PDFParser from "pdf2json";
import { urlFetch } from "./urlFetch";
import { getDashNumber, isDash, isDigit, isVoteValue, untilDashNumber } from "./stringUtil";

export async function loadPdf(pdfUrl: string) {
  const pdfData = await urlFetch(pdfUrl, false);

  return new Promise<Pdf2Json.Output>((resolve, reject) => {
    const pdfParser: Pdf2Json.PDFParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (err: any) => {
      console.error(err.parserError);
      reject(err);
    });
    pdfParser.on("pdfParser_dataReady", (pdfRes) => {
      resolve(pdfRes);
    });

    pdfParser.parseBuffer(pdfData);
  });
}

export function validateVotesPdf(pdf: Pdf2Json.Output) {
  const errors: string[] = [];
  if (pdf.Pages.length !== 1) {
    errors.push("expected votes PDF to have 1 page, found " + pdf.Pages.length);
  }
  const texts = pdf.Pages[0].Texts;
  return errors;
}

export function parseVotes(pdf: Pdf2Json.Output, expectedVotes: { yeas: number | null; nays: number | null }): VotePdfParsed {
  function text(txt: Pdf2Json.Text) {
    return decodeURIComponent(txt.R[0]?.T || "").trim();
  }

  const texts = pdf.Pages[0].Texts.map(text);
  let errors: string[] = [];

  const yeasTitleIdx = texts.findIndex(s => s.startsWith("Yeas"));
  const naysTitleIdx = texts.findIndex(s => s.startsWith("Nays"));
  const notVotingTitleIdx = texts.findIndex(s => s.startsWith("Not Voting"));
  const yeas = getDashNumber(texts, yeasTitleIdx);
  const nays = getDashNumber(texts, naysTitleIdx);
  const notVoting = getDashNumber(texts, notVotingTitleIdx);
  const titleIdx = -1;
  const presidingTitleIdx = texts.findIndex(s => s.startsWith("Presiding"));
  const votesTableStartIdx = presidingTitleIdx + 3;
  const [votes, parseVotesErrors] = parseVoteTable(texts, votesTableStartIdx);
  errors = errors.concat(parseVotesErrors);

  const title = titleIdx >= 0 ? texts[titleIdx] : "";
  return {
    title: title,
    date: "",
    time: "",
    headers: [
      { name: "yeas", value: yeas },
      { name: "nays", value: nays },
      { name: "not voting", value: notVoting },
    ],
    legand: [],
    sequence: 0,
    sessionDay: 0,
    votes,
    errors,
  };
}

function parseVoteTable(texts: string[], votesTableStartIdx: number): [VoteInfo[], string[]] {
  if (votesTableStartIdx < 0) {
    return [[], ["vote table not found"]];
  }
  const votes: VoteInfo[] = [];
  const errors: string[] = [];
  let idx = votesTableStartIdx;
  let counter = 1;
  while (idx < texts.length) {
    const [vote, errs, indexIncrement] = parseVoteItem(texts, idx);
    if (process.env.DEBUG) {
      console.log("parsing vote: ", vote);
    }
    if (vote != null) {
      votes.push(vote);
    }
    else if (errs) {
      errors.push("at vote " + counter, ...errs);
    }
    idx += indexIncrement;
    counter++;
  }
  return [votes, errors];
}

function parseVoteItem(texts: string[], idx: number): [VoteInfo | null, string[] | null, number] {
  const t0 = texts[idx];
  const voteValue = isVoteValue(t0) ? t0 : null;
  const offset = voteValue ? 1 : 0;
  const nameAndAreaId = untilDashNumber(texts, idx + offset);
  let errors: string[] = [];
  let inc = 1;
  let vote: VoteInfo | null = null;

  // '[Y/N]  Name[-Name]-##'
  if (nameAndAreaId != null) {
    const name = texts.slice(idx + offset, idx + offset + nameAndAreaId.increment - 2).join("");
    vote = {
      vote: voteValue || "-NA-" as VoteValue,
      name: name,
      areaId: nameAndAreaId.number,
    };
    inc = nameAndAreaId.increment + offset;
  }
  else {
    errors.push("expect vote value (Y, N, EX, AV), but encountered '" + t0 + "'");
  }

  if (vote?.name.startsWith("President ")) {
    vote.name = vote.name.substring("President ".length);
  }

  return [vote, errors.length > 0 ? errors : null, inc];
}
