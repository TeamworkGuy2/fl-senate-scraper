# FL Senate Scraper

Parse FL senate and house web pages for information. This toolkit includes:
* Parse information on bills and votes from FL congressional sessions
* Parse list of FL senators (names, party, district, counties)
* Parse list of FL house representatives (names, party, district, counties)

This project uses [Node.js](https://nodejs.org/) to download the bill web pages and PDFs containing the vote tallies. It parses that information and generates CSV or JSON files containing the results.
Instructions for how to run this tool yourself are in the [Usage](#usage) section.

## Retrieving bills & votes:
* URLs for bills are assumed to be: `https://www.flsenate.gov/Session/Bill/{year}/{billId}` (can be changed in [src/bills/scrapeBillPage.ts](src/scrapeBillPage.ts))
* The session year and bill are passed as command line arguments like: `node ./dest/index.js --year=2022 --bill=100,102,105 --outFile=output.(json|csv) --rows=[bill|voter]`
* The output file path/name is relative to the current directory
* All vote PDFs are loaded and parsed. Only the latest vote from 'House' and latest vote from 'Senate' are output; there may be multiple votes per chamber
* Results can be saved to CSV or JSON file format (or written to stdout/console as JSON if no `outFile` is specified)
  * The JSON file format is defined in [@types.d.ts](src/%40types.d.ts) as: `BillAndVotesParsed[]`
  * The CSV `bill` file format (the bill number is the first column in each row):
    ```CSV
    House
    Bill,1 - Ana,2 - Bob,3 - Sid
    100,Y,Y,N
    102,Y,,N
    103,Y,Y,EX

    Senate
    Bill,11 - Lori,52 - Carl,103 - Ali
    201,Y, ,N
    205,N,N,Y
    ```

  * The CSV `voter` file format (the district and congress person's name is the first column in each row):
    ```CSV
    House
    Bill,100,102,103
    1 - Ana,Y,Y,Y
    2 - Bob,Y,,Y
    3 - Sid,N,N,EX

    Senate
    Bill,201,205
    11 - Lori,Y,N
    52 - Carl, ,N
    103 - Ali,N,Y
    ```
* To see more detailed bill and vote information, set the `DEBUG` env variable, like `set DEBUG=* & node ./dest/index.js --year=2022 --bill=100 --outFile=output.csv`, this causes a `raw_output.json` file to be written in the current directory

## Retrieving a list of senators or representatives:
* The senator list is assumed to be found at: https://www.flsenate.gov/Senators
* The representatives list is assumed to be found at: https://www.myfloridahouse.gov/representatives
* The command line arguments for downloading these lists looks like: `node ./dest/index.js --fetch=[senate|congress] --outFile=output.json`
* Results can be saved to CSV or JSON file format (or written to stdout/console as JSON if no `outFile` is specified)
  * The JSON file format is defined in [@types.d.ts](src/%40types.d.ts) as: `Senator[]` for `senate` and `Representative[]` for `congress`
  * CSV output is __not__ currently supported


## Resources:

To find your Florida senator:
* https://www.flsenate.gov/Senators

To find your Florida representative:
* https://www.myfloridahouse.gov/Sections/Representatives/myrepresentative.aspx

A full list of laws can be retrieved from http://laws.flrules.org/node > pick \[year\] > click Apply.

TODO:
* Handle "Votes after roll call:" present in some PDFs, like [this one](https://www.flsenate.gov/Session/Bill/2022/434/Vote/SenateVote_s00434__018.PDF)

---
## Usage

To run this on your computer, you'll need a Javascript runtime. Preferably [Node.js](https://nodejs.org/) because this project is written in `TypeScript/Javascript`.

[Download Node.js](https://nodejs.org/en/download/) and install it. You can skip adding the `corepack` package manager, skip adding node to your computer path, and skip installing necessary tools. We won't need any of that to run this project.

![](doc/images/node-install-1.png)
![](doc/images/node-install-2.png)

Now, in your web browser go to the [Tags](https://github.com/TeamworkGuy2/fl-senate-scraper/tags) page of the project and download the `zip` or `tar.gz` of the latest release version. The latest version will be the first item at the top of the list.

![](doc/images/gh-tags.png)

Unzip the downloaded file and open up the folder.

![](doc/images/unzipped-proj-folder.png)

Find and open the `Node.js command prompt` that you installed earlier. If you're using Windows, this can be found by opening the start menu and searching for `node`, it should look like this:

![](doc/images/windows-find-node-cmd-prompt.png)

![](doc/images/node-cmd-prompt.png)

In the `Node.js command prompt`, `cd` into the project directory and press enter (`cd` is a command you run to navigate to a specific directory to run commands in that directory):

![](doc/images/navigate-node-cmd-prompt-to-proj-folder.png)

Now install dependencies by running `npm install` in the Node.js command prompt:

![](doc/images/npm-install-start.png)

Build the project by running `npm run build` in the Node.js command prompt:

![](doc/images/npm-install-and-build-success.png)

And run the project for the specific senate bills you wish to retrieve by running a command similar to:
```sh
node ./dest/index.js --year=2022 --bill=100 --outFile=output.csv
```

Where the `year`, `bill` and `outFile` values can be customized, see details at the top of this README file.

![](doc/images/ran-successfully.png)

An output file will be generated assuming there are no issues accessing and downloading data from flsenate.gov!

![](doc/images/results-csv.png)