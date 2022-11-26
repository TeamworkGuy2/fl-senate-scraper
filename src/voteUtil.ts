import { VotePdfParsed } from "./@types";

export function findLatestVote(votes: VotePdfParsed[], chamber: string) {
  let latestDate = new Date(0);
  let latestIdx = -1;

  let i = 0;
  for (const vote of votes) {
    if (vote.chamber === chamber) {
      const dateHeader = vote.headers.find(h => h.name === "Date");
      if (dateHeader != null) {
        const date = new Date(dateHeader.value as string);
        if (date > latestDate) {
          latestDate = date;
          latestIdx = i;
        }
      }
    }
    i++;
  }

  if (latestDate.getTime() > 0) {
    return votes[latestIdx];
  }
  return null;
}
