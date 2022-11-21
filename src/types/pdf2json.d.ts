import type { EventEmitter } from "events";
import type { Readable, Transform, Writable } from "stream";

export declare module Pdf2Json {

  class PDFParser extends EventEmitter {
    static colorDict: any;
    static fontFaceDict: any;
    static fontStyleDict: any;
    constructor();
    data: any;
    binBufferKey: string;
    parseBuffer(buffer: Buffer): void;
    loadPDF(pdfFilePath: string, verbosity?: number): Promise<void>;
    createParserStream(): ParserStream;
    on<K extends keyof EventMap>(eventName: K, listener: EventMap[K]): this;
    getRawTextContent(): any;
    getRawTextContentStream(): Readable;
    getAllFieldsTypes(): any;
    getAllFieldsTypesStream(): Readable;
    getMergedTextBlocksIfNeeded(): any;
    getMergedTextBlocksStream(): Readable;
  }

  type EventMap = {
    "pdfParser_dataError": (errMsg: string) => void;
    "pdfParser_dataReady": (pdfData: Output) => void;
    "readable": (meta: Output["Meta"]) => void;
    "data": (data: Output["Pages"][number]|null) => void;
  };

  class ParserStream extends Transform {
    static createContentStream(jsonObj: any): Readable;

    static createOutputStream(
    outputPath: string | Buffer | URL,
    resolve: (outputPath: any) => void,
    reject: (err: any) => void,
    ): Writable;

    constructor(pdfParser: any, options: any);
  }

  interface Output {
    Transcoder: string;
    Meta: Record<string, any>;
    Pages: Page[];
  }

  interface Page {
    Width: number;
    Height: number;
    HLines: Line[];
    VLines: Line[];
    Fills: Fill[];
    Texts: Text[];
    Fields: Field[];
    Boxsets: Boxset[];
  }

  interface Fill {
    x: number;
    y: number;
    w: number;
    h: number;
    oc?: string;
    clr?: number;
  }

  interface Line {
    x: number;
    y: number;
    w: number;
    oc?: string;
    clr?:number;
  }

  interface Text {
    x: number;
    y: number;
    w: number;
    sw: number;
    A: 'left' | 'center' | 'right';
    R: TextRun[]
    oc?: string;
    clr?: number;
  }

  interface TextRun {
    T: string;
    S: number;
    TS: [number, number, 0|1, 0|1];
    RA?: number;
  }

  interface Boxset {
    boxes: Box[];
    id : {
      Id: string;
      EN?: number;
    };
  }

  interface Field {
    id: {
      Id: string;
      EN?: number;
    };
    style: number;
    TI: number;
    AM: number;
    TU: string;
    x: number;
    y: number;
    w: number;
    h: number;
    T: {
      Name: 'alpha' | 'link';
      TypeInfo: {};
    };
  }

  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
    oc?: string;
    clr?: number
  }

  interface Box {
    id : {
      Id: string;
      EN?: number;
    };
    T: {
      Name: string;
      TypeInfo? : {};
    };
    x: number;
    y: number;
    w: number;
    h: number;
    TI: number;
    AM: number;
    checked?: boolean;
    style: number;
  }
}