import camelCase from "camelcase";

export const DEFAULT_PARSER_VALUE = Symbol("DEFAULT_PARSER_VALUE");

export interface NameValue {
  name: string;
  value: any;
}

/**
 * Parse objects from one or more HTML tables. The header row of each table forms
 * the default property names. Parsing can be customized via the 'mapCell' callback.
 * @param dom the document to query for the tables
 * @param tableQuery the query string to use to query the 'dom' for tables
 * @param debugName the name of the table for debugging/error messages
 * @param mapCell optional function to parse each table cell.
 * Receives 3 arguments, the 'TD' table cell HTML element, the column index, the destination object
 * to modify and return, it contains the column 'name' property and a null 'value' which the callback
 * should set, the callback may modify the 'name', or return a new object with 'name' and 'value' property,
 * or return 'DEFAULT_PARSER_VALUE' to run the standard behavior,
 * or return null if the column should not be parsed.
 * @returns the parsed table as an array of objects, each containing the column headers in 'camelCase' or
 * the property
 */
export function parseTables(
  dom: Document,
  tableQuery: string,
  debugName: string,
  mapCell?: ((element: HTMLTableCellElement, index: number, dst: NameValue) => NameValue | symbol | null)
) {
  const tables = dom.querySelectorAll(tableQuery);
  const parsedRows: Record<string, any>[] = [];
  for (const table of tables) {
    const rowElements = Array.from(table.querySelectorAll("tr"));
    const rows = parseRows(rowElements, debugName, mapCell);
    parsedRows.push(...rows);
  }
  return parsedRows;
}

/**
 * Parse objects from the rows of an HTML table. The header column forms the default property names.
 * Parsing can be customized via the 'mapCell' callback.
 * @param rows the table rows to parse, the first row is assumed to be the header,
 * the remaining rows are parsed and returned
 * @param debugName the name of the table for debugging/error messages
 * @param mapCell optional function to parse each table cell.
 * Receives 3 arguments, the 'TD' table cell HTML element, the column index, the destination object
 * to modify and return, it contains the column 'name' property and a null 'value' which the callback
 * should set, the callback may modify the 'name', or return a new object with 'name' and 'value' property,
 * or return 'DEFAULT_PARSER_VALUE' to run the standard behavior,
 * or return null if the column should not be parsed.
 * @returns the parsed table as an array of objects, each containing the column headers in 'camelCase' or
 * the property
 */
export function parseRows(
  rows: HTMLTableRowElement[],
  debugName: string,
  mapCell?: ((element: HTMLTableCellElement, index: number, dst: NameValue) => NameValue | symbol | null)
) {
  if (rows == null) {
    return [];
  }
  const [header, ...trs] = rows;
  const headers = Array.from(header.querySelectorAll("th")).map((td, idx) => camelCase(td.textContent?.replaceAll("&nbsp;", " ")?.trim() || ("" + idx)));
  const headerCount = headers.length;

  mapCell = mapCell || defaultCellParser;

  return trs.map((tr) => {
    const values = Array.from(tr.querySelectorAll("td"));
    const obj: Record<string, any> = {};
    if (headers.length !== values.length) {
      console.error(debugName + " row length (" + values.length + ") does not match header (" + headers.length + ") [" + headers.join(", ") + "]");
    }
    const res = {
      name: null as any as string,
      value: null as any,
    };
    for (let i = 0; i < headerCount; i++) {
      res.name = headers[i];
      res.value = null;
      let res2 = mapCell!(values[i], i, res);
      if (res2 === DEFAULT_PARSER_VALUE) {
        res2 = defaultCellParser(values[i], i, res);
      }
      if (res2 === res || isNameValue(res2)) {
        if (res2.value === DEFAULT_PARSER_VALUE) {
          res2 = defaultCellParser(values[i], i, res2);
        }
        obj[res2.name] = res2.value;
      }
    }
    return obj;
  });
}

export function defaultCellParser(elem: Element, index: number, dst: NameValue) {
  dst.value = trimmedHtml(elem);
  return dst;
}

export function trimmedHtml(elem: Element) {
  return elem.innerHTML?.replaceAll("&nbsp;", " ")?.trim()!;
}

export function isNameValue(obj: any): obj is NameValue {
  return obj != null && "name" in obj && "value" in obj;
}