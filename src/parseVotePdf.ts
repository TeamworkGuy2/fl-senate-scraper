/// <reference path="./types/pdf2json.d.ts" />
import { BillInfo, VoteInfo, VotePdfParsed, VoteValue } from "./@types";
import PDFParser = require("pdf2json");
import { urlFetch } from "./urlFetch";
import { getDashNumber, isVoteValue, splitFirst, startsWithAnyIndex, untilDashNumber } from "./stringUtil";


export async function loadPdf(pdfUrl: string) {
  const pdfData = await urlFetch(pdfUrl, false);

  return new Promise<PDFParser.Output>((resolve, reject) => {
    const pdfParser = new PDFParser();

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


export function validateVotesPdf(pdf: PDFParser.Output) {
  const errors: string[] = [];
  if (pdf.Pages.length !== 1) {
    errors.push("expected votes PDF to have 1 page, found " + pdf.Pages.length);
  }
  const texts = pdf.Pages[0].Texts;
  return errors;
}


export function parseVotes(
  pdf: PDFParser.Output,
  expectedVote: BillInfo["votes"]["0"],
  billId: string
): VotePdfParsed {
  function text(txt: PDFParser.Text) {
    return decodeURIComponent(txt.R[0]?.T || "").trim();
  }

  const texts = pdf.Pages[0].Texts.map(text);

  const yeasTitleIdx = texts.findIndex(s => s.startsWith("Yeas"));
  const naysTitleIdx = texts.findIndex(s => s.startsWith("Nays"));
  const notVotingTitleIdx = texts.findIndex(s => s.startsWith("Not Voting"));
  const yeas = getDashNumber(texts, yeasTitleIdx);
  const nays = getDashNumber(texts, naysTitleIdx);
  const notVoting = getDashNumber(texts, notVotingTitleIdx);
  const headers = parseHeaders(texts, yeasTitleIdx);
  const votesTableStartIdx = findVoteTableIndex(texts);
  const { votes, errors: parseVotesErrors } = parseVoteTable(texts, votesTableStartIdx);
  const errors = parseVotesErrors.slice();

  if (votes.length !== yeas! + nays! + notVoting!) {
    errors.push(`parsed votes (${votes.length}) doesn't match expect Yeas=${yeas} + Nays=${nays} + ${notVoting}`);
  }

  return {
    billId,
    link: expectedVote.link,
    chamber: expectedVote.chamber,
    headers: [
      { name: "Yeas", value: yeas },
      { name: "Nays", value: nays },
      { name: "Not Voting", value: notVoting },
      ...headers,
    ],
    votes,
    errors,
  };
}


function parseHeaders(
  texts: string[],
  limitIndex: number,
  headers = ["Sequence", "Session Day", "Calendar Page", "Date", "Time"],
) {
  const size = Math.min(limitIndex, texts.length);
  const results: { name: string; value: string }[] = [];
  for (var i = 0; i < size; i++) {
    const text = texts[i];
    const headerIdx = startsWithAnyIndex(text, headers);
    // headers can be in the format:
    // 'HEADER: value'
    // ['HEADER:', 'value']
    // ['HEADER', 'value']
    if (headerIdx >= 0) {
      const headerName = headers[headerIdx];
      const remainingValue = text.substring(headerName.length).trim();
      let value = text;
      if(text.endsWith(":") || headerName === text) {
        value = texts[i + 1];
        i++;
      }
      else if (remainingValue.startsWith(":")) {
        value = remainingValue.substring(1).trim();
      }
      results.push({
        name: headerName,
        value: value,
      });
    }
  }
  return results;
}


function parseVoteTable(texts: string[], votesTableStartIdx: number): { votes: VoteInfo[]; errors: string[] } {
  if (votesTableStartIdx < 0) {
    return { votes: [], errors: ["vote table not found"] };
  }
  const votes: VoteInfo[] = [];
  const errors: string[] = [];
  let idx = votesTableStartIdx;
  let counter = 1;
  // loop through all the text since we don't know where the table might end, whether there might be a footer
  while (idx < texts.length) {
    const [vote, errs, indexIncrement] = parseVoteItem(texts, idx);
    if (vote != null) {
      votes.push(vote);
    }
    else if (errs) {
      // 'Votes after roll call:' appears directly after the vote tallies table in some instances,
      // if we find it we know the table ended and it's not an error
      if (texts[idx].startsWith("Votes after"/* roll call*/)) {
        break;
      }
      errors.push("at vote " + counter, ...errs);
    }
    idx += indexIncrement;
    counter++;
  }
  return { votes, errors };
}


function parseVoteItem(texts: string[], idx: number): [VoteInfo | null, string[] | null, number] {
  const t0 = texts[idx];
  const voteValue = isVoteValue(t0) ? t0 : null;
  const offset = voteValue ? 1 : 0;
  const nameAndAreaId = untilDashNumber(texts, idx + offset);
  let errors: string[] = [];
  let inc = 1;
  let vote: VoteInfo | null = null;

  if (process.env.DEBUG) {
    console.log("parsing vote: ", voteValue, nameAndAreaId);
  }

  // '[Y/N]  Name[-Name]-##'
  if (nameAndAreaId != null) {
    const name = texts.slice(idx + offset, idx + offset + nameAndAreaId.increment - 2).join("");
    vote = {
      areaId: nameAndAreaId.number,
      voterName: name,
      vote: voteValue || "-NA-" as VoteValue,
    };
    inc = nameAndAreaId.increment + offset;
  }
  else {
    errors.push("expect vote value (Y, N, EX, AV), but encountered '" + t0 + "'");
  }

  if (vote?.voterName.startsWith("President ")) {
    vote.voterName = vote.voterName.substring("President ".length);
  }

  return [vote, errors.length > 0 ? errors : null, inc];
}


function findVoteTableIndex(texts: string[]) {
  const presidingTitleIdx = texts.findIndex(s => s.startsWith("Presiding"));
  const offset = presidingTitleIdx >= 0 && texts[presidingTitleIdx + 2] === "President" ? 4 : 3;
  return presidingTitleIdx + offset;
}
