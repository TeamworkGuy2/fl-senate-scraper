import { urlFetch } from "./urlFetch";

const origin = "https://www.flsenate.gov";

export async function getBill(year: string, billNumber: string) {
  const path = `/Session/Bill/${year}/${billNumber}`

  return urlFetch(origin + path, true).then((dom) => {
    var votes = parseBillPageForVotes(dom, path);
    return {
      votes,
    };
  });
}


function parseBillPageForVotes(dom: Document, billUrlPath: string) {
  var links = dom.querySelectorAll(
    `#tabBodyVoteHistory a[href*='${billUrlPath}/Vote/Senate'], ` +
    `#tabBodyVoteHistory a[href*='${billUrlPath}/Vote/House']`
  );
  return Array.from(links).map(a => {
    const voteLinkText = a.textContent;
    const ynParts = voteLinkText?.split(" - ") || [];
    const yeasIdx = ynParts.findIndex(s => s.includes("Yeas"));
    const naysIdx = ynParts.findIndex(s => s.includes("Nays"));
    const yeas = yeasIdx >= 0 ? parseInt(ynParts[yeasIdx]) : null;
    const nays = naysIdx >= 0 ? parseInt(ynParts[naysIdx]) : null;
    return {
      yeas,
      nays,
      link: origin + (a as HTMLAnchorElement).href,
    };
  });
}
