import { BillInfo } from "../@types";
import { parseTables, DEFAULT_PARSER_VALUE, trimmedHtml } from "../utils/htmlUtil";
import { betweenText } from "../utils/stringUtil";
import { urlFetch } from "../utils/urlFetch";

export const origin = "https://www.flsenate.gov";
export const chambers = ["Senate", "House"] as const;
export interface LinkParsed {
  link: string | null;
  text: string | null;
  rawHtml: string | null;
}

/** Get a bill from flsenate.gov and extract information about the bill from the webpage.
 * @param year the session year the bill was filled in
 * @param billNumber the bill number
 * @returns information and links from the webpage for that bill
 */
export async function fetchBill(year: string, billNumber: string): Promise<BillInfo> {
  const path = `/Session/Bill/${year}/${billNumber}`;
  const pathView = `${path}/ByCategory`

  return urlFetch(origin + pathView, true).then((dom) => {
    const votes = parseBillPageForVotes(dom, path);
    const billInfo = parseBillPageInfo(dom);
    const billHistory: any[] = parseBillHistoryTable(dom);
    const relatedBills: any[] = parseBillRelatedTable(dom);
    const billText: any[] = parseBillTextTable(dom);
    const citations: any[] = parseBillCitationsTable(dom);
    return {
      billId: billNumber,
      ...billInfo,
      billHistory,
      billText,
      citations,
      relatedBills,
      votes,
    };
  });
}


function parseBillPageInfo(dom: Document) {
  const titleHeader = dom.querySelector(".main h2");
  const title = titleHeader?.textContent || null;
  const snapshotDom = dom.querySelector("#snapshot");
  const summaryParagraphs = querySelectorAllBetween("p", titleHeader, snapshotDom);
  const summary = summaryParagraphs.map(p => p.textContent!.trim());
  const committeeItems = snapshotDom?.querySelectorAll("ol li");
  const committees = Array.from(committeeItems || []).map(li => li.textContent!.trim());
  const snapshotText = snapshotDom?.textContent || null;
  const [effectiveDate] = extractDateAfter(snapshotText, "Effective Date:");
  const [lastActionDate, lastActionDateIdx] = extractDateAfter(snapshotText, "Last Action:");
  const lastActionText = lastActionDateIdx ? betweenText(snapshotText, lastActionDateIdx, "Bill Text:")?.[0] ?? null : null;
  const billUrl = (<HTMLAnchorElement>snapshotDom?.querySelector("a.lnk_BillTextHTML"))?.href;
  const billPdf = (<HTMLAnchorElement>snapshotDom?.querySelector("a.lnk_BillTextPDF"))?.href;
  return {
    title,
    summary,
    effectiveDate,
    lastActionDate,
    lastActionText,
    billUrl,
    billPdf,
    committees,
  }
}

function parseBillHistoryTable(dom: Document) {
  return parseTables(dom, "#tabBodyBillHistory table", "bill history");
}

function parseBillCitationsTable(dom: Document) {
  return parseTables(dom, "#tabBodyCitations table", "bill citation", (td, _, dst) => {
    if (dst.name === "citation") {
      dst.value = parseLink(td);
      return dst;
    }
    // shorten column name and remove HTML wrapper element
    else if (dst.name === "locationInBillLocationInBillHelp") {
      const links = isFirstChildLink(td)
        ? [parseFileLink(td)]
        : Array.from(td.children).map((child) => parseFileLink(child));
      return {
        name: "locationInBill",
        value: links,
      };
    }
    else if (dst.name === "chapterLaw") {
      const link = parseFileLink(td);
      dst.value = link;
      return dst;
    }
    else {
      return DEFAULT_PARSER_VALUE;
    }
  });
}

function isFirstChildLink(elem: Element | null | undefined) {
  return elem?.children?.length! > 0 && (elem?.children[0] as HTMLElement)?.tagName === "A";
}

function parseLink(linkParent: Element | null | undefined) {
  if (linkParent == null) {
    return DEFAULT_PARSER_VALUE;
  }
  const linkElem = linkParent.children?.length > 0 ? linkParent.children[0] as HTMLElement : null;
  const link = linkElem?.tagName === "A" ? (linkElem as HTMLAnchorElement | null)?.href : null;
  const text = linkElem?.textContent ?? linkParent?.textContent ?? "";
  if (link == null) {
    return DEFAULT_PARSER_VALUE;
  }
  return {
    link,
    text,
    rawHtml: trimmedHtml(linkParent),
  };
}

function parseFileLink(linkParent: Element) {
  const link = parseLink(linkParent);
  if (link === DEFAULT_PARSER_VALUE) {
    return DEFAULT_PARSER_VALUE;
  }
  const fileType = linkParent?.children[1]?.className?.includes("filetype") ? linkParent?.children[1]?.textContent : null;
  (link as any).fileType = fileType;
  return link as (LinkParsed & { fileType: string | null });
}

function parseBillRelatedTable(dom: Document) {
  return parseTables(dom, "#tabBodyRelatedBills table", "related bills", (td, _, dst) => {
    // skip this column
    if (dst.name === "trackBills") {
      return null;
    }
    // we only want the link
    else if (dst.name === "billNumber") {
      const billLink = getChild(td, "A")?.href ?? DEFAULT_PARSER_VALUE;
      return {
        name: "billLink",
        value: billLink,
      };
    }
    else {
      return DEFAULT_PARSER_VALUE;
    }
  });
}

function parseBillTextTable(dom: Document) {
  return parseTables(dom, "#tabBodyBillText table", "bill text", (td, _, dst) => {
    if (dst.name === "format") {
      dst.value = Array.from(td.querySelectorAll("a") || []).map((elem) => {
        const type = elem.title?.includes("PDF") ? "PDF" : "HTML";
        return { type, link: elem.href };
      });
      return dst;
    }
    else if (dst.name === "redistrictingPlan") {
      dst.value = getChild(td, "A")?.textContent ?? DEFAULT_PARSER_VALUE;
      return dst;
    }
    else {
      return DEFAULT_PARSER_VALUE;
    }
  }).map((obj) => {
    if (obj.format) {
      const linkUrl = (<any[]>obj.format).find(x => x.type === "HTML");
      const linkPdf = (<any[]>obj.format).find(x => x.type === "PDF");
      if (linkUrl) {
        obj.linkUrl = linkUrl?.link;
      }
      if (linkPdf) {
        obj.linkPdf = linkPdf?.link;
      }
      if (linkUrl || linkPdf) {
        delete obj["format"];
      }
    }
    return obj;
  });
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
function extractDateAfter(str: string | null | undefined, prefix: string): [date: Date | null, startIdx: number] {
  const prefixIdx = str?.indexOf(prefix) || -1;
  if (str == null || prefixIdx < 0) {
    return [null, -1];
  }
  const searchStr = str.substring(prefixIdx + prefix.length);
  const nextMultiSpaceIdx = searchStr.search(/\s{2,}/);
  if (nextMultiSpaceIdx < 0) {
    return [null, -1];
  }
  const date = new Date(searchStr.substring(0, nextMultiSpaceIdx).trim());
  return !isNaN(date.valueOf()) ? [date, prefixIdx + prefix.length] : [null, -1];
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

function getChild<T extends Uppercase<keyof HTMLElementTagNameMap>>(elem: HTMLElement, childTag: T) {
  return elem.children?.length === 1 && elem.children?.[0].tagName === "A"
    ? (<HTMLElementTagNameMap[Lowercase<T>]>elem.children[0])
    : null;
}