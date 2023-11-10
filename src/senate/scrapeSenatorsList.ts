import { URL } from "url";
import { Senator } from "../@types";
import { urlFetch } from "../utils/urlFetch";

export function fetchSenators(pageUrl = 'https://www.flsenate.gov/Senators') {
  const url = new URL(pageUrl);
  const domain = url.origin;

  return urlFetch(pageUrl, true).then((dom) => {
    const table = dom.querySelector("body table#Senators");
    if (table == null) {
      throw new Error("'#Senators' table not found on page");
    }
    const colHeaders = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent?.trim().toLowerCase());
    if (colHeaders.length < 4) {
      throw new Error("'#Senators' table expected to contain 4 or more columns, found " + colHeaders.length);
    }
    expectColumn(colHeaders[0], 'senator');
    expectColumn(colHeaders[1], 'district');
    expectColumn(colHeaders[2], 'party');
    expectColumn(colHeaders[3], 'counties');
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr:not(#NoMatch)")).map((tr, i) => parseSenatorRow(domain, tr, i + 1));
    return rows;
  });
}

function expectColumn(value: string | null | undefined, expected: string) {
  if (value !== expected) {
    throw new Error(`'#Senators' table column 1 expected to be '${expected}', found '${value}'`);
  }
}

function parseSenatorRow(domain: string, tr: HTMLTableRowElement, index?: number): Senator {
  const td1 = tr.children[0];
  const td2 = tr.children[1];
  const td3 = tr.children[2];
  const td4 = tr.children[3];

  const td1Link = td1.querySelector("a.senatorLink") as HTMLAnchorElement;
  const td1Thumbnail = td1.querySelector("img.senatorThumb") as HTMLImageElement;
  const name = td1Link.textContent?.trim();
  const district = td2.textContent?.trim();

  if (name?.length! < 1) {
    throw new Error("no name found at row " + index + ", empty or null");
  }
  if (district?.length! < 1) {
    throw new Error("no district ID found at row " + index + ", empty or null");
  }

  return {
    name: name!,
    title: Array.from(td1.querySelectorAll(":scope > :not(a)")).map(e => e?.textContent?.trim()).filter(s => !!s).join(" ") || undefined,
    link: domain + td1Link.href,
    imageLink: domain + td1Thumbnail.src,
    district: district!,
    party: td3.textContent?.trim() ?? "",
    counties: td4.textContent?.trim() ?? "",
  };
}