import * as fs from "fs";
import { BillAndVotesParsed, Law } from "./@types";
import * as Csv from "./utils/csvUtil";
import { chambers } from "./bills/scrapeBillPage";
import { findLatestVote } from "./bills/voteUtil";
import * as XlsxReaderWriter from "xlsx-spec-utils/XlsxReaderWriter";
import * as jszip from "jszip";


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
    for (const res of results) {
      let i = 0;
      for (const vote of res.votes) {
        const dateHeader = vote.headers.find(h => h.name === "Date");
        const timeHeader = vote.headers.find(h => h.name === "Time");
        if (dateHeader) {
          const { billId, link, chamber, date: oldDate, errors, ...rest } = res.votes[i];
          res.votes[i] = {
            billId,
            link,
            chamber,
            date: oldDate || `${dateHeader}${timeHeader ? ' ' + timeHeader : ''}`,
            errors: errors?.length! > 0 ? errors : undefined,
            ...rest,
          };
        }
        i++;
      }
    }
    debugger;

    if (outFile.endsWith("json")) {
      const resultJson = JSON.stringify(results, undefined, "  ");
      fs.writeFileSync(outFile, resultJson, { encoding: "utf8" });
    }
    else if (outFile.endsWith("csv")) {
      const rowFormat = byBillOrVoter === "voter" ? "voter" : "bill";
      for (const chamber of chambers) {
        const resultCsv = csvStringify(results, chamber, rowFormat);
        fs.writeFileSync(addFileNameSuffix(outFile, `-${chamber}`), resultCsv, { encoding: "utf8" });
      }
    }
    /* TODO: work-in-progress
    else if (outFile.endsWith("xlsx")) {
      const rowFormat = byBillOrVoter === "voter" ? "voter" : "bill";
      const resultData = toXlsx(results, rowFormat);
      fs.writeFileSync(outFile, resultData, { encoding: "binary" });
    }
    */
    else {
      console.error("unknown output file format '" + outFile + "'");
    }
  }
  else {
    const resultJson = JSON.stringify(results, undefined, "  ");
    console.log(resultJson);
  }
}

function toXlsx(resultSets: BillAndVotesParsed[], byBillOrVoter: "bill" | "voter"): string {
  // Load an existing file as a template
  var excelZippedFileData = fs.readFileSync('./template.xlsx');
  var excelDataUnzipped = XlsxReaderWriter.readZip(/*Uint8Array*/excelZippedFileData, jszip);
  var workbook = XlsxReaderWriter.loadXlsxFile({
    sheetCount: 1
  }, (path) => (excelDataUnzipped.files[path] != null ? excelDataUnzipped.files[path].asText() : null)!);

  // TODO write resultsSets

  // Write the xlsx file data back to the JSZip instance
  XlsxReaderWriter.saveXlsxFile(workbook, (path, data) => {
    // fix to remove namespace definitions from elements and attribute to fix for excel
    data = data.replace(/ xmlns=""/g, "");
    excelDataUnzipped.file(path, data);
  });
  return excelDataUnzipped.generate({ type: "string", compression: "DEFLATE" });
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
    if (process.env.DEBUG) {
      console.log("latest vote for " + bill.billId + " (" + chamber + "):", latestVote?.link);
    }
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
    else {
      console.error(`no latest vote found for bill ${bill.billId}`);
    }
  }
  return voterRecordsMap;
}


function csvStringify(resultSets: BillAndVotesParsed[], chamber: "Senate" | "House", byBillOrVoter: "bill" | "voter"): string {
  function orEmptyVoteResponse(vote: string | null | undefined) {
    return !vote || vote === "-NA-" ? "" : vote;
  }

  const voterRecordsMap = buildVoterRecordsMap(chamber, resultSets);

  const idNames = Object.keys(voterRecordsMap).sort(sortVoterIds);

  if (process.env.DEBUG) {
    console.log("writing " + chamber + " idNames:", JSON.stringify(idNames));
    //console.log("writing " + chamber + " voterRecordMap:", JSON.stringify(voterRecordsMap));
  }

  const rows: string[][] = [];
  if (byBillOrVoter === "bill") {
    // rows by bill #
    for (const bill of resultSets) {
      const billId = bill.billId;
      const billVotes = idNames.map((idName) => orEmptyVoteResponse(voterRecordsMap[idName][billId]));
      const billName = bill.title || String(billId);
      rows.push([billName, billId, ...billVotes]);
    }

    // header rows containing the bill names & chamber name, then the bill/voter rows
    return Csv.stringify([`${chamber} - Bill Name`, "Bill", ...idNames], rows);
  }
  else {
    // rows by voter ID
    for (const idName of idNames) {
      const voterRecords = voterRecordsMap[idName];
      const voterBills = resultSets.map((bill) => orEmptyVoteResponse(voterRecords[bill.billId]));
      rows.push([idName, ...voterBills]);
    }

    const billIds = resultSets.map((bill) => bill.billId);
    const billNames = resultSets.map((bill) => bill.title || String(bill.billId));

    return Csv.stringify([`${chamber} - Bill Name`, ...billNames], [["Bill", ...billIds]].concat(rows));
  }
}


function addFileNameSuffix(path: string, suffix: string) {
  const lastDotIdx = path.lastIndexOf('.');
  return path.substring(0, lastDotIdx) + suffix + path.substring(lastDotIdx);
}

function sortVoterIds(a: string, b: string) {
  const diff = parseInt(a) - parseInt(b);
  return diff !== 0 ? diff : a.localeCompare(b);
}


function sortBillIds(a: string, b: string) {
  const aNum = isNumeric(a);
  const bNum = isNumeric(b);
  if (aNum && !bNum) {
    return -1;
  }
  if (bNum && !aNum) {
    return 1;
  }

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

/**
 * @returns true if the input argument is a number or a string representation of a number, false if not
 */
function isNumeric(n: number | string | null | undefined): boolean {
  return /^[0-9]+$/.test(n as any);
}
