import * as fs from "fs";
import { BillAndVotesParsed, VotePdfParsed } from "./@types";
import { loadPdf, parseVotes, validateVotesPdf } from "./parseVotePdf";
import { getBill } from "./scrapeBillPage";
import { writeOutput } from "./writeOutput";

function run() {
  const year = findArg("year");
  const bills = findArg("bill")?.split(",").filter(s => s.length > 0);
  const outFile = findArg("outFile");
  const inFile = findArg("inFile");

  if (!year || !bills) {
    console.log("'--year=####' or '--bill=###,###,###' argument missing, usage: 'node ./dest/index.js --year=2022 --bill=100' --outFile=output.(json|csv)");
    return;
  }
  if (process.env.DEBUG) {
    console.log("loading bills [" + bills + "], year: " + year + ", saving to file: " + outFile);
  }

  let resPromise: Promise<PromiseSettledResult<BillAndVotesParsed | { error: any }>[]>;
  if (!inFile) {
    resPromise = Promise.allSettled(bills.map(bill => {
      return parseBillVotes(year, bill).then((res) => {
        console.log("loaded " + res.votes.length + " vote results for bill #" + res.billId);
        return res;
      }).catch((err) => {
        return { error: err };
      })
    }));
  }
  else {
    const inFileContents = fs.readFileSync(inFile, { encoding: "utf8" });
    resPromise = Promise.resolve(JSON.parse(inFileContents));
  }

  resPromise.then((resultsAndErrors) => {
    if (process.env.DEBUG && !inFile) {
      fs.writeFileSync("raw_output.json", JSON.stringify(resultsAndErrors, undefined, "  "), { encoding: "utf8" });
    }

    writeOutput(outFile, resultsAndErrors);
  }).catch((err) => {
    console.error("Error loading bills:", err);
  });
}


export async function parseBillVotes(
  year: string,
  billId: string,
): Promise<BillAndVotesParsed> {
  // parse the bill page for PDF links to house/senate votes
  const bill = await getBill(year, billId);
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

run();
