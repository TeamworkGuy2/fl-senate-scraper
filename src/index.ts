import * as fs from "fs";
import { BillAndVotesParsed } from "./@types";
import {
  arrayToChunks,
  isPromiseSettledResult,
  runAsyncBatchActionsInSeries,
} from "./utils/miscUtil";
import { fetchLawSessions } from "./bills/fetchLawList";
import { parseBill } from "./bills/parseBill";
import { fetchRepresentatives } from "./congress/scrapeRepresentativesList";
import { fetchSenators } from "./senate/scrapeSenatorsList";
import { writeBillsOutput, writeLawsOutput, writePersonsOutput } from "./writeOutput";
import { getBillNumberFromId } from "./bills/scrapeBillPage";

function main() {
  const year = findArg("year");
  let bills = findArg("bill")?.split(",").filter(s => s.length > 0);
  const outFile = findArg("outFile");
  const inFile = findArg("inFile");
  const byBillOrVoter = findArg("rows");
  const fetch = findArg("fetch");

  if (!inFile && !year && !fetch) {
    console.log("Usage: 'node ./dest/index.js --year=2022 [--bill=100,101,...] --outFile=output.(json|csv) --rows=[bill|voter]");
    console.log("or: 'node ./dest/index.js --inFile=bills-and-laws-2021.json --outFile=output.(json|csv) --rows=[bill|voter]");
    console.log("or: 'node ./dest/index.js --fetch=[senate|congress] --outFile=legislators.json");
    console.log("or: 'node ./dest/index.js --fetch=laws --year=2022 --outFile=laws.json");
    // TODO testing: node ./dest/index.js --inFile=bills-and-laws-2021.json --outFile=output-spreadsheet-2021.xlsx --rows=voter
    return;
  }

  if (fetch) {
    if (process.env.DEBUG) {
      console.log("loading " + fetch + " member list");
    }
    // fetch senators (names, districts, etc) from senate website
    if (fetch === "senate") {
      fetchSenators().then((senators) => {
        writePersonsOutput(outFile, "senators", senators);
      });
    }
    // fetch representatives (names, districts, etc) from house website
    else if (fetch === "congress") {
      fetchRepresentatives().then((representatives) => {
        writePersonsOutput(outFile, "representatives", representatives);
      });
    }
    // fetch laws for a given year from 'laws.flrules.org'
    else if (fetch === "laws") {
      fetchLawSessions(year!).then((laws) => {
        writeLawsOutput(outFile, laws);
      });
    }
    else {
      throw new Error("unknown fetch argument '" + fetch + "', expected 'senate' or 'congress'");
    }
  }
  // fetch bills
  else {
    let resPromise: Promise<PromiseSettledResult<BillAndVotesParsed | { error: any }>[]>;
    // from senate website directly
    if (!inFile) {
      // get all bill IDs for the year if none are provided
      let pBills = Promise.resolve(bills);
      if (!bills) {
        console.log(`looking up all bill IDs for ${year}...`);
        pBills = fetchLawSessions(year!).then((sessions) => {
          return sessions.reduce((laws, s) => laws.concat(s.laws.map((law) => getBillNumberFromId(law.billId))), [] as string[]);
        });
      }

      resPromise = pBills.then((bills) => {
        if (process.env.DEBUG) {
          console.log(`loading bills from year ${year}, saving to file '${outFile}', bills: [${bills}]`);
        }
        return runAsyncBatchActionsInSeries(arrayToChunks(bills!, 40), (billSubset, i) =>
          Promise.allSettled(billSubset.map(bill => {
            return parseBill(year!, bill).then((res) => {
              console.log("loaded " + res.votes.length + " vote results for bill #" + res.billId);
              return res;
            }).catch((err) => {
              return { error: err };
            });
          }))
        );
      });
    }
    // or from previously saved file
    else {
      if (process.env.DEBUG) {
        console.log("loading bills from file: " + inFile + ", saving to file: " + outFile);
      }
      const inFileContents = fs.readFileSync(inFile, { encoding: "utf8" });
      // handle 'DEBUG' raw_output.json formatted files as well as regular JSON output formatted files
      resPromise = Promise.resolve((JSON.parse(inFileContents)).map(bv => {
        return isPromiseSettledResult(bv) ? bv : { status: "fulfilled", value: bv };
      }));
    }
    // write output
    resPromise.then((resultsAndErrors) => {
      if (process.env.DEBUG && !inFile) {
        fs.writeFileSync("raw_output.json", JSON.stringify(resultsAndErrors, undefined, "  "), { encoding: "utf8" });
      }
      writeBillsOutput(outFile, resultsAndErrors, byBillOrVoter);
    }).catch((err) => {
      console.error("Error loading bills:", err);
    });
  }
}


function findArg(name: string) {
  const nameSuffix = "--" + name + "=";
  const arg = (<string[]>(process.argv || [])).find((s) => s.startsWith(nameSuffix));
  if (arg) {
    const parts = arg.split("=");
    return parts[1];
  }
  return null;
}


main();
