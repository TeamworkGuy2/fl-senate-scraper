import { BillAndVotesParsed, VotePdfParsed } from "../@types";
import { loadPdf, parseVotes, validateVotesPdf } from "./parseVotePdf";
import { fetchBill } from "./scrapeBillPage";

/**
 * Extract all of the vote tally records associated with a bill.
 * And return the bill info and vote tallies.
 * @param year the year the bill was proposed
 * @param billId the bill identifier. Can be the numeric identifier like '102'
 * or '5-B' (for non-regular session bills). Or can be a full identifier like 'H 32'.
 * @returns a promise of the parsed bill info and votes
 */
 export async function parseBill(
  year: string,
  billId: string,
): Promise<BillAndVotesParsed> {
  // parse the bill page for PDF links to house/senate votes
  const bill = await fetchBill(year, billId);
  const { votes: voteLinks } = bill;
  console.log("found " + voteLinks.length + " vote PDFs:", voteLinks);

  // parse the votes PDFs
  const pVoteTallies = voteLinks.map(vote => {
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
  const { voteSets, errors } = (await Promise.allSettled(pVoteTallies)).reduce((sets, res) => {
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
