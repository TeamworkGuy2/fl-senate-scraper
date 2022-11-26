import { VoteValue } from "./@types";

export function startsWithAnyIndex(str: string, searchStrs: string[]) {
  for (var i = 0, size = searchStrs.length; i < size; i++) {
    if (str.startsWith(searchStrs[i])) {
      return i;
    }
  }
  return -1;
}

export function splitFirst(str: string, splitter: string): [string, string] | [string] {
  const idx = str.indexOf(splitter);
  if (idx >= 0) {
    return [str.substring(0, idx), str.substring(idx + splitter.length)];
  }
  else {
    return [str];
  }
}


export function remove<T>(ary: T[], removes: (T | null)[]): T[] {
  const res = ary.slice();
  for (const remove of removes) {
    const idx = remove != null ? res.indexOf(remove) : -1;
    if (idx >= 0) {
      res.splice(idx, 1);
    }
  }
  return res;
}


export function getDashNumber(texts: string[], textIdx: number): number | null {
  if (textIdx < 0) {
    return null;
  }
  const text0 = texts[textIdx];
  const text1 = texts[textIdx + 1] || "";
  const text2 = texts[textIdx + 2] || "";
  // ['text - ###']
  if (text0.includes("-") && isDigit(text0[text0.length - 1])) {
    const parts = text0.split("-");
    return parseInt(parts[parts.length - 1].trim());
  }
  // ['text', '- ###']
  else if (text1.includes("-") && isDigit(text1[text1.length - 1])) {
    const parts = text1.split("-");
    return parseInt(parts[parts.length - 1].trim());
  }
  // ['text', '-', '###']
  else if (text1.includes("-") && isDigit(text2[0])) {
    return parseInt(text2);
  }
  return null;
}


export function untilDashNumber(texts: string[], textIdx: number): { number: number; increment: number } | null {
  if (textIdx < 0) {
    return null;
  }
  const count = texts.length;
  let idx = textIdx + 1;
  let text0 = texts[idx - 1];
  let text1 = texts[idx] || "";
  while (idx < count && !(isDigit(text1[0]) && isDash(text0))) {
    text0 = text1;
    text1 = texts[idx + 1];
    idx++;
  }
  if (text1 != null && isDigit(text1[0]) && isDash(text0)) {
    return { number: parseInt(text1), increment: idx - textIdx + 1 };
  }
  else {
    return null;
  }
}


export function isDash(char: string | null) {
  return char?.length === 1 && !isDigit(char) && !isAlpha(char);
}


export function isAlpha(char: string | null) {
  const charCode = (char?.charCodeAt(0) as number) & ~0x20;
  return (65/*'A'*/ <= charCode) && (charCode <= 90/*'Z'*/);
}


export function isDigit(char: string) {
  return char >= "0" && char <= "9";
}


export function isVoteValue(str: string): str is VoteValue {
  return str === "Y" || str === "N" || str === "EX" || str === "AV";
}
