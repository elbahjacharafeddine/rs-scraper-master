const { performanceWrapping } = require("./helper/performanceWrapping");
const { setupBrowserPage } = require("./helper/setupBrowserPage");

const SCIMAGOJR_URL = "https://www.scimagojr.com/journalsearch.php?";
const POSSIBLE_JOURNALS_SELECTOR =
  "body > div.journaldescription.colblock > div.search_results > a";
const SJR_LIST_SELECTOR = "body > div:nth-child(14) > div > div.cellcontent > div:nth-child(2) > table > tbody > tr"
  // "body > div:nth-child(14) > div:nth-child(1) > div.cellcontent > div:nth-child(2) > table > tbody > tr";


// const PUBLICATION_TYPE_SELECTOR =
//   "body > div:nth-child(7) > div > div > div:nth-child(5) > p";

const PUBLICATION_TYPE_SELECTOR =
    "body > div:nth-child(7) > div > div:nth-child(2) > div:nth-child(2) > div:nth-child(5) > p";

const DIRECT_NAVIGATION_OPTIONS = {
  waitUntil: "load",
  timeout: 0,
};
const puppeteer = require('puppeteer')

let browser;

// Function to launch the Puppeteer browser if not already launched.
async function getBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    userDataDir: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}

const journalData = async ({ journalName, year }) => {
  // const { browser, page } = await setupBrowserPage({
  //   allowedRequests: [],
  // });
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.goto(
      `${SCIMAGOJR_URL}q=${journalName}`,
      DIRECT_NAVIGATION_OPTIONS
    );
    console.log('navigate to scimagorJR')

    const matchingJournal = await page.evaluate(
      async (journalName, POSSIBLE_JOURNALS_SELECTOR) => {
        const trimJournalName = ({ journalName }) =>
          journalName.toLowerCase().replace(/[-_: #]/g, "").replace("&","and");
        try {
          const possibleJournals = [
            ...document.querySelectorAll(POSSIBLE_JOURNALS_SELECTOR),
          ].map((a) => ({
            link: a.href,
            name: a.querySelector("span").textContent,
          }));

          const matchingJournals = possibleJournals.filter(({ name }) => {
            return (
              trimJournalName({ journalName }) ===
              trimJournalName({ journalName: name })
            );
          });

          if (matchingJournals.length === 0) return null;
          else return matchingJournals[0];
        } catch (error) {
          return error;
        }
      },
      journalName,
      POSSIBLE_JOURNALS_SELECTOR
    );

    if (matchingJournal && matchingJournal.link)
      await page.goto(matchingJournal.link, DIRECT_NAVIGATION_OPTIONS);
    else return { error: matchingJournal };
    console.log('navigate to first link from the array ...')
    // const publicationType = await page.evaluate(
    //   async (PUBLICATION_TYPE_SELECTOR) =>
    //     document.querySelector(PUBLICATION_TYPE_SELECTOR).textContent,
    //   PUBLICATION_TYPE_SELECTOR
    // );
    //
    // if (publicationType.toLocaleLowerCase().includes("conference"))
    //   return { error: "conference" };
    console.log('start to collect SJR')
    await autoScrollToPercentage(page, 35)
    const selector = 'body > div.dashboard > div.cell1x1.dynamiccell > div.cellheader > div.combo_buttons > div.combo_button.table_button > img'
    await page.waitForSelector(selector);
    await page.click(selector);

    await page.waitForTimeout(1000)

    // const SJR = await page.evaluate(
    //   async (year, SJR_LIST_SELECTOR) => {
    //     try {
    //       const results = [...document.querySelectorAll(SJR_LIST_SELECTOR)]
    //         .map((a) => [...a.querySelectorAll("td")])
    //         // .filter((tds) => tds.length === 2)
    //         .map((a) => ({ year: a[0].textContent, sjr: a[1].textContent }))
    //         .sort((a, b) => (parseInt(a.year) < parseInt(b.year) ? 1 : -1))
    //         .sort(
    //           (a, b) =>
    //             Math.abs(parseInt(a.year) - parseInt(year)) -
    //             Math.abs(parseInt(b.year) - parseInt(year))
    //         );
    //       console.log('fin for SJR next step ...')
    //       console.log(results)
    //       if (results.length === 0) return null;
    //       else {
    //         // console.log(results)
    //         return results[0].sjr
    //       };
    //
    //     } catch (error) {
    //
    //       return { error} ;
    //     }
    //   },
    //   year,
    //   SJR_LIST_SELECTOR
    // );



    const datta = await page.evaluate(() => {
      const tableRows = Array.from(document.querySelectorAll('.dashboard .cellcontent div:nth-child(2).cellslide table tbody tr'));
      const rowData = tableRows.map(row => {
        const [yearCell, sjrCell] = row.querySelectorAll('td');
        return {
          year: yearCell.textContent.trim(),
          sjr: sjrCell.textContent.trim(),
        };
      });
      return rowData;
    });
    const filteredData = datta.filter(item => !isNaN(parseInt(item.year)));
    console.log(filteredData)
    let sjr="-"
    for (const item of filteredData) {
      console.log(item.year)
      if (item.year == year && parseInt(item.sjr)<=3) {
        sjr = item.sjr;
        break;
      }
      else if(parseInt(item.year) ==year-1 && parseInt(item.sjr)<=3){
        sjr = item.sjr
      }
    }
    console.log('dans la derniere etape ...')
    return { journal: { SJR:sjr } };
  } catch (error) {
    return { error };
  } finally {
    await page.close();
    await browser.close();
    //
  }
};

async function autoScrollToPercentage(page, percentage) {
  if (percentage <= 0 || percentage >= 100) {
    throw new Error('Percentage value should be between 0 and 100');
  }

  await page.evaluate(async (targetPercentage) => {
    await new Promise((resolve) => {
      const targetScrollHeight = Math.floor((targetPercentage / 100) * document.body.scrollHeight);
      let currentScrollHeight = 0;
      const distance = 200;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        currentScrollHeight += distance;

        if (currentScrollHeight >= targetScrollHeight || currentScrollHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }, percentage);
}

module.exports = {
  journalData
};
