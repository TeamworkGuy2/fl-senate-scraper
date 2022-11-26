import { BillInfo } from "./@types";
import { urlFetch } from "./urlFetch";

export const origin = "https://www.flsenate.gov";
export const chambers = ["Senate", "House"] as const;

/** Get a bill from flsenate.gov and extract information about the bill from the webpage.
 * @param year the session year the bill was filled in
 * @param billNumber the bill number
 * @returns information and links from the webpage for that bill
 */
export async function getBill(year: string, billNumber: string): Promise<BillInfo> {
  const path = `/Session/Bill/${year}/${billNumber}`;
  const pathView = `${path}/ByCategory`

  return urlFetch(origin + pathView, true).then((dom) => {
    const votes = parseBillPageForVotes(dom, path);
    const billInfo = parseBillPageForInfo(dom);
    return {
      billId: billNumber,
      billUrl: `${origin}${path}/BillText/er/HTML`,
      billPdf: `${origin}${path}/BillText/er/PDF`,
      ...billInfo,
      votes,
    };
  });
}


function parseBillPageForInfo(dom: Document) {
  const titleHeader = dom.querySelector(".main h2");
  const title = titleHeader?.textContent || null;
  const snapshotDom = dom.querySelector("#snapshot");
  const summaryParagraphs = querySelectorAllBetween("p", titleHeader, snapshotDom);
  const summary = summaryParagraphs.map(p => p.textContent!.trim());
  const committeeItems = snapshotDom?.querySelectorAll("ol li");
  const committees = Array.from(committeeItems || []).map(li => li.textContent!.trim());
  const snapshotText = snapshotDom?.textContent || null;
  const effectiveDate = extractDateAfter(snapshotText, "Effective Date:");
  const lastActionDate = extractDateAfter(snapshotText, "Last Action:");
  return {
    title,
    summary,
    effectiveDate,
    lastActionDate,
    committees,
  }
}


function parseBillPageForVotes(dom: Document, billUrlPath: string) {
  function asChamber(chamber: string | null): "Senate" | "House" | null {
    return chambers.includes(chamber as any) ? chamber as any : null;
  }

  const links = dom.querySelectorAll(
    `#tabBodyVoteHistory a[href*='${billUrlPath}/Vote/Senate'], ` +
    `#tabBodyVoteHistory a[href*='${billUrlPath}/Vote/House']`
  );
  return Array.from(links).map(a => {
    const voteLinkText = a.textContent;
    const chamberElem = a.parentElement?.previousElementSibling;
    const chamber = asChamber(chamberElem?.textContent?.trim() || null);
    const dateElem = chamberElem?.previousElementSibling;
    const date = dateElem?.textContent?.trim() || null;
    const ynParts = voteLinkText?.split(" - ") || [];
    const yeasIdx = ynParts.findIndex(s => s.includes("Yeas"));
    const naysIdx = ynParts.findIndex(s => s.includes("Nays"));
    const yeas = yeasIdx >= 0 ? parseInt(ynParts[yeasIdx]) : null;
    const nays = naysIdx >= 0 ? parseInt(ynParts[naysIdx]) : null;
    return {
      yeas,
      nays,
      link: origin + (a as HTMLAnchorElement).href,
      chamber,
      date,
    };
  });
}


/** Find text in the middle of a multiline string and try to parse a
 * date immediately following the matching text.
 * @param str the large search string
 * @param prefix the target text preceeding the date
 * @returns a date or null
 */
function extractDateAfter(str: string | null | undefined, prefix: string) {
  const prefixIdx = str?.indexOf(prefix) || -1;
  if (str == null || prefixIdx < 0) {
    return null;
  }
  const searchStr = str.substring(prefixIdx + prefix.length);
  const nextMultiSpaceIdx = searchStr.search(/\s{2,}/);
  if (nextMultiSpaceIdx < 0) {
    return null;
  }
  const date = new Date(searchStr.substring(0, nextMultiSpaceIdx).trim());
  return !isNaN(date.valueOf()) ? date : null;
}


/** Find elements that match a query selector limited to elements that lie
 * between the 'recedingSibling' and 'succeedingSibling' elements. These two elements
 * MUST share the same 'parentElement'.
 * @param selector 
 * @param precedingSibling 
 * @param succeedingSibling 
 * @returns 
 */
function querySelectorAllBetween(
  selector: string,
  precedingSibling: Element | null,
  succeedingSibling: Element | null
) {
  const parent = precedingSibling?.parentElement;
  if (parent !== succeedingSibling?.parentElement) {
    console.error("cannot query between two elements that are not siblings");
    return [];
  }
  const matches = Array.from(parent?.querySelectorAll(selector) || []);
  const results: Element[] = [];
  let elem = precedingSibling?.nextElementSibling;
  while (elem != null && elem != succeedingSibling) {
    if (matches.includes(elem)) {
      results.push(elem);
    }
    elem = elem.nextElementSibling;
  }
  return results;
}
