import * as fs from "fs";
import { BillAndVotesParsed } from "./@types";
import * as Csv from "./csvUtil";
import { chambers } from "./scrapeBillPage";
import { findLatestVote } from "./voteUtil";

export function writeOutput(outFile: string | null, resultsAndErrors: PromiseSettledResult<BillAndVotesParsed | { error: any }>[]) {
  const errors = resultsAndErrors.filter((r): r is PromiseRejectedResult => r.status === "rejected" || (r.value as any).error).map(r => r.reason || (r as any).value.error);
  const results = resultsAndErrors.filter((r): r is PromiseFulfilledResult<BillAndVotesParsed> => r.status === "fulfilled").map(r => r.value);

  if (errors?.length > 0) {
    console.error(errors.length + " errors:");
    console.error(JSON.stringify(errors, undefined, "  "));
  }

  if (outFile) {
    if (outFile.endsWith("json")) {
      const resultJson = JSON.stringify(results, undefined, "  ");
      fs.writeFileSync(outFile, resultJson, { encoding: "utf8" });
    }
    else if (outFile.endsWith("csv")) {
      const resultCsv = csvStringify(results);
      fs.writeFileSync(outFile, resultCsv, { encoding: "utf8" });
    }
    else {
      console.error("unknown output file format '" + outFile + "'");
    }
  }
  else {
    const resultJson = JSON.stringify(results, undefined, "  ");
    console.log(resultJson);
  }
}


function csvStringify(resultSets: BillAndVotesParsed[]): string {
  function orEmptyVoteResponse(vote: string | null | undefined) {
    return !vote || vote === "-NA-" ? "" : vote;
  }

  // build a map of 'areaId - voterName' to the bill IDs and votes cast by that voter
  const voterRecordsMaps = chambers.reduce((map, c) => {
    map[c] = {};
    return map;
  }, <{ [chamber in "Senate" | "House"]: { [idName: string]: { [billId: string]: string/*vote*/ } } }>{});

  for (const res of resultSets) {
    for (const chamber of chambers) {
      // bill may have no votes for a given chamber
      const latestVote = findLatestVote(res.votes, chamber);
      console.log("latest vote for " + res.billId + " (" + chamber + "):", latestVote?.link);
      if (latestVote != null) {
        const voterRecordsMap = voterRecordsMaps[chamber];
        for (const vote of latestVote.votes) {
          const idName = vote.areaId + " - " + vote.voterName;
          let voterRecord = voterRecordsMap[idName];
          if (voterRecord == null) {
            voterRecord = voterRecordsMap[idName] = {};
          }
          else if (voterRecord[res.billId] != null) {
            throw new Error("duplicate bill ID '" + res.billId + "' encountered for voter record '" + idName + "'");
          }
          voterRecord[res.billId] = vote.vote;
        }
      }
    }
  }

  const csvSections: string[] = [];

  for (const chamber of ["House", "Senate"]) {
    const voterRecordsMap = voterRecordsMaps[chamber];

    const idNames = Object.keys(voterRecordsMap).sort((a, b) => { const res = parseInt(a) - parseInt(b); return res !== 0 ? res : a.localeCompare(b); });

    if (process.env.DEBUG) {
      console.log("writing " + chamber + " idNames:", JSON.stringify(idNames));
      console.log("writing " + chamber + " voterRecordMap:", JSON.stringify(voterRecordsMap));
    }

    const voterRecordRows: string[][] = [];
    let i = 0;
    for (const res of resultSets) {
      const billId = res.billId;
      const billVotes = idNames.map((idName) => orEmptyVoteResponse(voterRecordsMap[idName][billId]));
      voterRecordRows.push([billId, ...billVotes]);
      i++;
    }

    csvSections.push(Csv.stringify([chamber], []));
    csvSections.push(Csv.stringify(["bill_id", ...idNames], voterRecordRows));
  }

  return csvSections.join(Csv.CSV_ENDLINE);
}
