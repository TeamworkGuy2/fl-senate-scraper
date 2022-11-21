import { VotePdfParsed } from "./@types";
import { loadPdf, parseVotes, validateVotesPdf } from "./parsePdf";
import { getBill } from "./scrapeBillPage";

function run() {
  const year = findArg("year");
  const bill = findArg("bill");
  const outFile = findArg("outFile");

  if (!year || !bill) {
    console.log("'--year=####' or '--bill=###' argument missing, usage: 'node ./dest/index.js --year=2022 --bill=100' --outFile=output.(json|csv)");
    return;
  }
  else if (process.env.DEBUG) {
    console.log("loading bill:" + { year, bill, outFile });
  }

  parseBillVotes(year, bill, outFile);
}


export async function parseBillVotes(year: string, bill: string, outputFile: string) {
  // parse the bill page for PDF links to house/senate votes
  const { votes: voteLinks } = await getBill(year, bill);
  console.log("found " + voteLinks.length + " vote PDFs:", voteLinks);

  // parse the votes PDFs
  const pdfPromises: Promise<(VotePdfParsed | string)>[] = [];
  for (const vote of voteLinks) {
    const pPdf = loadPdf(vote.link).then((pdfRes) => {
      const errors = validateVotesPdf(pdfRes);
      if (errors.length > 0) {
        return "Found errors in votes PDF '" + vote.link  + "': " + errors.join(", ");
      }
      else {
        return parseVotes(pdfRes, vote);
      }
    });
    pdfPromises.push(pPdf);
  }

  // await the results
  const { voteSets, errors } = (await Promise.all(pdfPromises)).reduce((sets, res) => {
    if (typeof res === "string") { sets.errors.push(res); }
    else { sets.voteSets.push(res); }
    return sets;
  }, { voteSets: <VotePdfParsed[]>[], errors: <string[]>[] });

  console.log("loaded " + voteSets.length + " vote results:");
  console.log(JSON.stringify(voteSets, undefined, '  '));
  if (errors?.length > 0) {
    console.error(errors.length + " vote errors:");
    console.error(JSON.stringify(errors, undefined, '  '));
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

run();
