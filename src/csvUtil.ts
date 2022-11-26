// Quote '"'
export const CSV_QUOTE = String.fromCharCode(34);
export const CSV_DOUBLE_QUOTE = CSV_QUOTE + CSV_QUOTE;
// CRLF
export const CSV_ENDLINE = String.fromCharCode(13, 10);
// Comma ','
export const CSV_COMMA = String.fromCharCode(44);

export function stringify(headers: string[], records: string[][]) {
  return encodeCsvLines([headers, ...records], null, CSV_QUOTE, CSV_COMMA, false);
}

/** Write data to a comma separated values (CSV) file. This method tries to follow
 * RFC 4180: <a href="http://tools.ietf.org/html/rfc4180">http://tools.ietf.org/html/rfc4180</a>
 * @param lines the values to encode. The first dimension of the list represents lines,
 * the second dimension represents column values of each line.
 * These values will automatically be quoted and commas ',' will be escaped.
 * @param nullString the string to write in replacement of null strings in
  * the 'lines' array. If null, this value will default to "".
  * @param quoteChar the character that starts and ends a quoted string. The CSV default is a quote (")
  * @param fieldSeparatorChar the separator character that separates fields. The CSV default is a comma (,)
  * @param includeLastNewline true to include a newline after the last line (following the spec),
  * false to not have an ending newline (for example when writing creating a single CSV line)
  * @returns the CSV line as a string
  */
function encodeCsvLines(lines: string[][], nullString: string | null, quoteChar: string, fieldSeparatorChar: string, includeLastNewline: boolean) {
  if (nullString == null) { nullString = ""; }

  let res = "";
  let row = 0;
  for (const line of lines) {
    // allows us to programmatically write the last line
    if (row > 0) {
      res += CSV_ENDLINE;
    }
    const columnCount = line.length;
    let columnC = 0;
    for (let value of line) {
      if (value == null) {
        value = nullString;
      }
      res += encodeCsvValue(value);
      // Write a comma after each column except the last column
      if (columnC < columnCount - 1) {
        res += CSV_COMMA;
      }
      columnC++;
    }
    row++;
  }
  if (includeLastNewline) {
    res += CSV_ENDLINE;
  }

  return res;
}


function encodeCsvValue(columnValue: string) {
  return encodeCsvValueCustom(columnValue, CSV_QUOTE, CSV_ENDLINE, CSV_COMMA, CSV_DOUBLE_QUOTE);
}


function encodeCsvValueCustom(
  columnValue: string,
  escapeSeqPrimary: string,
  escapeSeq2: string,
  escapeSeq3: string,
  escapeSeqPrimaryReplacement: string,
) {
  let shouldQuote = false;
  let containsQuote = columnValue.includes(escapeSeqPrimary);
  let containsEndline = columnValue.includes(escapeSeq2);
  let containsComma = columnValue.includes(escapeSeq3);
  // If the string contains quotes, double quote the quotes to escape them
  if (containsQuote || containsEndline || containsComma) {
    shouldQuote = true;
    if (containsQuote) {
      columnValue = columnValue.replace(escapeSeqPrimary, escapeSeqPrimaryReplacement);
    }
  }
  // Write the column value
  if (shouldQuote) {
    return escapeSeqPrimary + columnValue + escapeSeqPrimary;
  }
  else {
    return columnValue;
  }
}
