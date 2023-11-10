import { URL } from "url";
import { Representative } from "../@types";
import { urlFetch } from "../utils/urlFetch";

export function fetchRepresentatives(pageUrl = 'https://www.myfloridahouse.gov/representatives') {
  const url = new URL(pageUrl);
  const domain = url.origin;

  return urlFetch(pageUrl, true).then((dom) => {
    const list = dom.querySelector("main .team-page");
    if (list == null) {
      throw new Error("representatives list not found on page");
    }
    const rows = Array.from(list.querySelectorAll<HTMLDivElement>(".team-box")).map((tr, i) => parseRepresentativeCard(domain, tr, i + 1));
    return rows;
  });
}

function parseRepresentativeCard(domain: string, card: HTMLDivElement, index?: number): Representative {
  const cardMain = card.children[0] as HTMLAnchorElement;
  const thumbnailDiv = cardMain.children[0];
  const descriptionDiv = cardMain.children[1];

  if (cardMain?.children?.length! < 2) {
    throw new Error("expected representative info card to contain two elements, a thumbnail and description, at index " + index);
  }

  const name = descriptionDiv.children[0].textContent?.trim();
  const partyAndDistrictP = descriptionDiv.children[1];
  const areaDescription = descriptionDiv.children[2]?.textContent?.trim();
  const term = descriptionDiv.children[3].textContent?.trim().replace(/\s+/g, " ");
  const party = partyAndDistrictP?.childNodes[0]?.textContent?.replace(String.fromCharCode(8212), "").trim();
  const district = partyAndDistrictP?.childNodes[1]?.textContent?.replace("District: ", "").trim();

  if (name?.length! < 1) {
    throw new Error("no name found at row " + index + ", empty or null");
  }
  if (district?.length! < 1) {
    throw new Error("no district ID found at row " + index + ", empty or null");
  }

  return {
    name: name!,
    link: domain + cardMain.href,
    imageLink: domain + thumbnailDiv.querySelector("img")?.attributes?.getNamedItem("data-src")?.value,
    district: district!,
    party: party ?? "",
    areaDescription: areaDescription ?? "",
    term: term ?? "",
  };
}