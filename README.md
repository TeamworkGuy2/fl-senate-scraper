FL Senate Scaper
==============

Scrap FL senate bill pages for information.
* URLs are assumed to be in the format: `https://www.flsenate.gov/Session/Bill/{year}/{billId}`
* The session year and bill are passed as command line arguments like: `node ./dest/index.js --year=2022 --bill=100 --outFile=output.(json|csv)`
* All vote PDFs are loaded and parsed
* Results are dumped to console as JSON

TODO
* Provide way to filter vote PDFs or only parse last one found on the bill page
* Allow output to CSV or JSON
* Save output to file specified via command line argument
