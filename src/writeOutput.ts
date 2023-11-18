import * as fs from "fs";
import { BillAndVotesParsed, Law } from "./@types";
import * as Csv from "./utils/csvUtil";
import { chambers } from "./bills/scrapeBillPage";
import { findLatestVote } from "./bills/voteUtil";

/**
 * Write a JSON or CSV file containing the parsed bills and votes and/or errors
 * @param outFile the file path and name, if not null it must end with 'json' or 'csv'.
 * If null, the bills and votes are stringified to JSON and written to standard output.
 * @param resultsAndErrors the parsed bills and votes or errors
 * @param byBillOrVoter optional string, only used if the 'outFile' ends with 'csv'.
 * If this is the string 'voter' then the CSV output has the rows as voter IDs and the columns as bill IDs.
 * If this is the string 'bill' or null then the CSV output has the rows as bill IDs and the columns as voter IDs.
 */
export function writeBillsOutput(
  outFile: string | null,
  resultsAndErrors: PromiseSettledResult<BillAndVotesParsed | { error: any }>[],
  byBillOrVoter?: string | null,
) {
  const errors = resultsAndErrors.filter((r): r is PromiseRejectedResult => r.status === "rejected" || (r.value as any).error).map(r => r.reason || (r as any).value.error);
  const results = resultsAndErrors.filter((r): r is PromiseFulfilledResult<BillAndVotesParsed> => r.status === "fulfilled").map(r => r.value).sort((a, b) => sortBillIds(a.billId, b.billId));

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
      const rowFormat = byBillOrVoter === "voter" ? "voter" : "bill";
      const resultCsv = csvStringify(results, rowFormat);
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

export function writePersonsOutput(
  outFile: string | null,
  type: string,
  persons: { name: string; district: string | number; }[]
) {
  console.log(`found ${persons.length} ${type}: writing to ${outFile || "standard output"}`);

  const results = persons.slice().sort((a, b) => sortVoterIds(a.district + " " + a.name, b.district + " " + b.name));
  if (outFile) {
    const resultJson = JSON.stringify(results, undefined, "  ");
    fs.writeFileSync(outFile, resultJson, { encoding: "utf8" });
  }
  else {
    const resultJson = JSON.stringify(results, undefined, "  ");
    console.log(resultJson);
  }
}

export function writeLawsOutput(outFile: string | null, lawsBySession: { session: string; laws: Law[]; }[]) {
  console.log(`writing ${lawsBySession.length} sessions containing ${
    lawsBySession.reduce((sum, s) => (sum + s.laws.length), 0)
  } laws total to ${outFile || "standard output"}`);

  const results = lawsBySession.slice().sort((a, b) => a.session.localeCompare(b.session)).map(s => ({
    ...s,
    laws: s.laws.slice().sort((a, b) => sortBillIds(a.billId, b.billId)),
  }));
  if (outFile) {
    const resultJson = JSON.stringify(results, undefined, "  ");
    fs.writeFileSync(outFile, resultJson, { encoding: "utf8" });
  }
  else {
    const resultJson = JSON.stringify(results, undefined, "  ");
    console.log(resultJson);
  }
}

/**
 * Build a map of 'areaId - voterName' to the bill IDs and votes cast by that voter.
 */
function buildVoterRecordsMap(chamber: string, billsWithVotes: BillAndVotesParsed[]) {
  const voterRecordsMap: { [idName: string]: { [billId: string]: string/*vote*/ } } = {};

  for (const bill of billsWithVotes) {
    // bill may have no votes for a given chamber
    const latestVote = findLatestVote(bill.votes, chamber);
    console.log("latest vote for " + bill.billId + " (" + chamber + "):", latestVote?.link);
    if (latestVote != null) {
      for (const vote of latestVote.votes) {
        const idName = vote.areaId + " - " + vote.voterName;
        let voterRecord = voterRecordsMap[idName];
        if (voterRecord == null) {
          voterRecord = voterRecordsMap[idName] = {};
        }
        else if (voterRecord[bill.billId] != null) {
          throw new Error("duplicate bill ID '" + bill.billId + "' encountered for voter record '" + idName + "'");
        }
        voterRecord[bill.billId] = vote.vote;
      }
    }
  }
  return voterRecordsMap;
}


function csvStringify(resultSets: BillAndVotesParsed[], byBillOrVoter: "bill" | "voter"): string {
  function orEmptyVoteResponse(vote: string | null | undefined) {
    return !vote || vote === "-NA-" ? "" : vote;
  }

  const csvSections: string[] = [];

  for (const chamber of chambers) {
    const voterRecordsMap = buildVoterRecordsMap(chamber, resultSets);

    const idNames = Object.keys(voterRecordsMap).sort(sortVoterIds);

    if (process.env.DEBUG) {
      console.log("writing " + chamber + " idNames:", JSON.stringify(idNames));
      console.log("writing " + chamber + " voterRecordMap:", JSON.stringify(voterRecordsMap));
    }

    if (csvSections.length > 0) {
      csvSections.push(Csv.stringify([], []));
    }
    csvSections.push(Csv.stringify([chamber], []));

    const rows: string[][] = [];
    if (byBillOrVoter === "bill") {
      // rows by bill #
      for (const bill of resultSets) {
        const billId = bill.billId;
        const billVotes = idNames.map((idName) => orEmptyVoteResponse(voterRecordsMap[idName][billId]));
        rows.push([billId, ...billVotes]);
      }

      csvSections.push(Csv.stringify(["Bill", ...idNames], rows));
    }
    else {
      // rows by voter ID
      for (const idName of idNames) {
        const voterRecords = voterRecordsMap[idName];
        const voterBills = resultSets.map((bill) => orEmptyVoteResponse(voterRecords[bill.billId]));
        rows.push([idName, ...voterBills]);
      }

      csvSections.push(Csv.stringify(["Bill", ...resultSets.map((bill) => bill.billId)], rows));
    }
  }

  return csvSections.join(Csv.CSV_ENDLINE);
}


function sortVoterIds(a: string, b: string) {
  const diff = parseInt(a) - parseInt(b);
  return diff !== 0 ? diff : a.localeCompare(b);
}


function sortBillIds(a: string, b: string) {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen > bLen) {
    return 1;
  }
  if (aLen < bLen) {
    return -1;
  }
  
  return a.localeCompare(b);
}
