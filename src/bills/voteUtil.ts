import { VotePdfParsed } from "../@types";

export function findLatestVote(votes: VotePdfParsed[], chamber: string) {
  let latestDate = new Date(0);
  let latestIdx = -1;

  let i = 0;
  for (const vote of votes) {
    if (vote.chamber === chamber) {
      let date = new Date(vote.date!);
      // back up method to handle older files before the 'vote.date' property was added
      if (isNaN(date.getTime())) {
        const dateHeader = vote.headers.find(h => h.name === "Date");
        const timeHeader = vote.headers.find(h => h.name === "Time");
        if (dateHeader != null) {
          date = new Date(dateHeader.value as string + (timeHeader?.value != null ? " " + timeHeader.value as string : ""));
        }
      }
      if (!isNaN(date.getTime())) {
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
