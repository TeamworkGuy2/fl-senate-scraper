import * as fs from "fs";
import { BillAndVotesParsed, VotePdfParsed } from "./@types";
import { arrayToChunks, runAsyncBatchActionsInSeries } from "./utils/miscUtil";
import { loadPdf, parseVotes, validateVotesPdf } from "./bills/parseVotePdf";
import { fetchBill } from "./bills/scrapeBillPage";
import { writeBillsOutput, writePersonsOutput } from "./writeOutput";
import { fetchRepresentatives } from "./congress/scrapeRepresentativesList";
import { fetchSenators } from "./senate/scrapeSenatorsList";

function main() {
  const year = findArg("year");
  const bills = findArg("bill")?.split(",").filter(s => s.length > 0);
  const outFile = findArg("outFile");
  const inFile = findArg("inFile");
  const byBillOrVoter = findArg("rows");
  const fetch = findArg("fetch");

  if (!inFile && (!year || !bills) && !fetch) {
    console.log("Usage: 'node ./dest/index.js --year=2022 --bill=100,101,... --outFile=output.(json|csv) --rows=[bill|voter]");
    console.log("or: 'node ./dest/index.js --fetch=[senate|congress] --outFile=output.json");
    return;
  }

  // fetch senator/representative list
  if (fetch) {
    if (process.env.DEBUG) {
      console.log("loading " + fetch + " member list");
    }
    if (fetch === "senate") {
      fetchSenators().then((senators) => {
        console.log("found " + senators.length + " senators:", "wrote to " + (outFile || "standard output"));
        writePersonsOutput(outFile, senators);
      });
    }
    else if (fetch === "congress") {
      fetchRepresentatives().then((representatives) => {
        console.log("found " + representatives.length + " representatives:", "wrote to " + (outFile || "standard output"));
        writePersonsOutput(outFile, representatives);
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
      if (process.env.DEBUG) {
        console.log("loading bills [" + bills + "], year: " + year + ", saving to file: " + outFile);
      }
      resPromise = runAsyncBatchActionsInSeries(arrayToChunks(bills!, 40), (billSubset, i) =>
        Promise.allSettled(billSubset.map(bill => {
          return parseBill(year!, bill).then((res) => {
            console.log("loaded " + res.votes.length + " vote results for bill #" + res.billId);
            return res;
          }).catch((err) => {
            return { error: err };
          })
        }))
      );
    }
    // or from previously saved file
    else {
      if (process.env.DEBUG) {
        console.log("loading bills from file: " + inFile + ", saving to file: " + outFile);
      }
      const inFileContents = fs.readFileSync(inFile, { encoding: "utf8" });
      resPromise = Promise.resolve(JSON.parse(inFileContents));
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


export async function parseBill(
  year: string,
  billId: string,
): Promise<BillAndVotesParsed> {
  // parse the bill page for PDF links to house/senate votes
  const bill = await fetchBill(year, billId);
  const { votes: voteLinks } = bill;
  console.log("found " + voteLinks.length + " vote PDFs:", voteLinks);

  // parse the votes PDFs
  const pdfPromises = voteLinks.map(vote => {
    return loadPdf(vote.link).then((pdfRes) => {
      const errors = validateVotesPdf(pdfRes);
      if (errors.length > 0) {
        throw new Error("Found errors in votes PDF '" + vote.link  + "': " + errors.join(", "));
      }
      else {
        return parseVotes(pdfRes, vote, bill.billId);
      }
    });
  });

  // await the results
  const { voteSets, errors } = (await Promise.allSettled(pdfPromises)).reduce((sets, res) => {
    if (res.status === "rejected") {
      sets.errors.push(res.reason);
    }
    else {
      sets.voteSets.push(res.value);
    }
    return sets;
  }, { voteSets: <VotePdfParsed[]>[], errors: <any[]>[] });

  return { ...bill, errors, votes: voteSets };
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
