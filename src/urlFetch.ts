import * as https from "https";
import * as JSDOM from "jsdom";

export async function urlFetch(url: string, parseHtml: true): Promise<Document>
export async function urlFetch(url: string, parseHtml: false): Promise<Buffer>;
export async function urlFetch(url: string, parseHtml: boolean): Promise<Buffer | Document>;
export async function urlFetch(url: string, parseHtml: boolean): Promise<Buffer | Document> {
  return new Promise<Buffer | Document>((resolve, reject) => {
    // request the web page
    https.get(url, (msg) => {
      const htmlChunks: any[] = [];

      msg.on("data", (chk) => htmlChunks.push(chk));

      msg.on("error", (err) => {
        console.error("failed to retrieve doc from " + url, err);
        reject(err);
      });

      msg.on("end", () => {
        if (process.env.DEBUG) {
          console.log("Response Headers:", msg.headers);
        }
        const html = Buffer.concat(htmlChunks);
        // parse the result
        if (parseHtml) {
          resolve(parseHtmlDoc(html.toString("utf-8")));
        }
        else {
          resolve(html);
        }
      });
    });
  });
}


function parseHtmlDoc(html: string | Buffer): Document {
    var dom = new JSDOM.JSDOM(html, { contentType: "text/html" }).window.document;
    return dom;
}
