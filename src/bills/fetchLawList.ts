import { Law, LawDocument } from "../@types";
import { urlFetch } from "../utils/urlFetch";

/**
 * Fetch the sessions and laws for a given year.
 * The code relies on the web page matching a very specific format.
 * @param year the year to pull laws for
 * @param pageUrl the URL to fetch the law list from, default is 'https://laws.flrules.org/node'
 * @returns an array of objects each containing a session name and list of law names, bill IDs, and links to the law's text
 */
export function fetchLawSessions(year: string, pageUrl = 'https://laws.flrules.org/node') {
  const url = new URL(pageUrl);
  const domain = url.origin;

  return fetchYearNid(year, pageUrl).then((nid) => {
    return urlFetch(pageUrl + "?field_list_year_nid=" + nid, true).then((doc) => {
      const tables = Array.from(doc.querySelectorAll<HTMLTableElement>("#content .view-content table"));
      if (tables.length < 1) {
        throw new Error("Expected at least 1 session table, found none");
      }

      const sessions: { session: string; auxiliaryDocuments: LawDocument[], laws: Law[] }[] = [];

      let idx = 0;
      for (const table of tables) {
        const sessionCaption = table.querySelector("caption");
        const colHeaders = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent?.trim().toLowerCase());
        if (colHeaders.length < 4) {
          throw new Error("Session table expected to contain 4, found " + colHeaders.length);
        }
        expectColumn(colHeaders, 0, 'chapter law number');
        expectColumn(colHeaders, 1, 'size');
        expectColumn(colHeaders, 2, 'description');
        expectColumn(colHeaders, 3, 'bill number');
        const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))
          .map((tr, i) => parseLawRow(domain, tr, i + 1));
        const auxiliaryDocs = rows.filter(r => r.billId === year);
        const laws = rows.filter(r => r.billId !== year);

        sessions.push({
          session: sessionCaption?.textContent?.trim() ?? `${idx}`,
          auxiliaryDocuments: auxiliaryDocs,
          laws: laws,
        });
        idx++;
      }

      return sessions;
    });
  });
}

/**
 * Find the 'nid' value of a given year in the year selection dropdown on the 'laws.flrules.org/node' web page.
 * Or throws an error if a matching dropdown option cannot be found.
 */
function fetchYearNid(year: string, pageUrl = 'https://laws.flrules.org/node') {
  return urlFetch(pageUrl, true).then((doc) => {
    const select = doc.querySelector("body select#edit-field-list-year-nid");
    if (select == null) {
      throw new Error("Year dropdown not found, looking for 'select#edit-field-list-year-nid");
    }
    const matches = Array.from(select.querySelectorAll("option")).filter(s => year === s.textContent?.trim());
    if (matches.length < 1) {
      throw new Error("Did not find any results for year '" + year + "' in dropdown");
    }
    if (matches.length > 1) {
      throw new Error("Found multiple results for year '" + year + "' in dropdown, expected a single result");
    }
    return matches[0].value;
  });
}

function parseLawRow(domain: string, tr: HTMLTableRowElement, index: number): Law {
  const td1 = tr.children[0];
  //const td2 = tr.children[1]; // don't need the PDF size
  const td3 = tr.children[2];
  const td4 = tr.children[3];

  const td1Link = td1.querySelector("span > a") as HTMLAnchorElement;
  const billId = td4.textContent?.trim();

  if (billId?.length! < 1) {
    throw new Error(`Expect each law row to have an ID in the 4th column, found nothing for row ${index + 1}`);
  }

  return {
    billId: billId!,
    documentName: td1Link.textContent?.trim() ?? "",
    documentLink: domain + td1Link.href,
    description: td3.textContent?.trim() ?? "",
  };
}

function expectColumn(values: (string | undefined)[], idx: number, expected: string) {
  if (values[idx] !== expected) {
    throw new Error(`Session '.view-content table' column ${idx + 1} expected to be '${expected}', found '${values[idx]}'`);
  }
}
