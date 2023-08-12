const { performanceWrapping } = require("./helper/performanceWrapping");
const { setupBrowserPage } = require("./helper/setupBrowserPage");

const bioxbio_URL = "https://www.bioxbio.com/journal/";
const SCOPUS_PROFILE_URL = "https://www.scopus.com/authid/detail.uri?authorId=56515263800";
const DIRECT_NAVIGATION_OPTIONS = {
  waitUntil: "load",
  timeout: 0,
};

const IFData = async ({ source }) => {
  const { browser, page } = await setupBrowserPage({
    allowedRequests: ["xhr", "script"],
  });
  console.log(source);

  try {
    await page.goto(
      bioxbio_URL + source,
      DIRECT_NAVIGATION_OPTIONS
    );

    if (process.env.DEBUG == "true") {
      const fileName = Date.now() + ".png";
      console.log("screenshot : ", fileName);
      await page.screenshot({
        path: "./public/screenshots/" + fileName,
        fullPage: true,
      });
    }

    console.log( bioxbio_URL + source);

    //await page.waitForSelector(".highcharts-root path");

    let author = await page.evaluate(() => {
      const name = [document
        .querySelector("body > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(4) > div:nth-child(1) > div:nth-child(1) > table >tbody")]
        .map((tr) => [...tr.querySelectorAll("td")])
        .map((a) => ({ year:[a[5].textContent.split("/")[1],a[5].textContent.split("/")[0],a[10].textContent,a[15].textContent,a[20].textContent,a[25].textContent] , IF: [a[7].textContent,a[7].textContent,a[12].textContent,a[17].textContent,a[22].textContent,a[27].textContent]}))
              
      
      return {
        name,
      };
    });
   

    if (!author) throw "Exception : No author data";

    return { author };
  } catch (error) {
    console.error(error);
    return { error };
  } finally {
    await page.close();
    await browser.close();
  }
};
module.exports = { IFData };
