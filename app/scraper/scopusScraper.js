const { performanceWrapping } = require("./helper/performanceWrapping");
const { setupBrowserPage } = require("./helper/setupBrowserPage");

const PLATFORM = "scopus";
const SCOPUS_PROFILE_URL = "https://www.scopus.com/authid/detail.uri?";

const SCOPUS_SEARCH_URL =
  "https://www.scopus.com/results/authorNamesList.uri?sort=count-f" +
  "&src=al" +
  "&sid=ea647886136e8ebb1b9b68f063130655" +
  "&sot=al" +
  "&sdt=al" +
  "&sl=44" +
  "&orcidId=" +
  "&selectionPageSearch=anl" +
  "&reselectAuthor=false" +
  "&activeFlag=true" +
  "&showDocument=false" +
  "&resultsPerPage=20" +
  "&offset=1" +
  "&jtp=false" +
  "&currentPage=1" +
  "&previousSelectionCount=0" +
  "&tooManySelections=false" +
  "&previousResultCount=0" +
  "&authSubject=LFSC" +
  "&authSubject=HLSC" +
  "&authSubject=PHSC" +
  "&authSubject=SOSC" +
  "&exactAuthorSearch=false" +
  "&showFullList=false" +
  "&authorPreferredName=" +
  "&origin=searchauthorfreelookup" +
  "&affiliationId=" +
  "&txGid=da4b13b8b82d35f517bbdfe31d48fe71";

const DIRECT_NAVIGATION_OPTIONS = {
  waitUntil: "load",
  timeout: 0,
};

const puppeteer = require('puppeteer')
let browser
async function getBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    userDataDir: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}


const authorSearch = async ({ authorName }) => {
  // const { browser, page } = await setupBrowserPage({
  //   allowedRequests: [],
  // });
const browser = await getBrowser()
  const page = await browser.newPage();
  await page.setUserAgent('Chrome/96.0.4664.93');
  await page.setDefaultNavigationTimeout(85000);
  // await page.waitForFunction(() => document.readyState === 'complete');
  const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  try {
    const params =
        authorName.trim().split(" ").length > 1
            ? "&st1=" +
            authorName.split(" ")[0] +
            "&st2=" +
            authorName.split(" ")[1].replace(" ", "%20")
            : "&st1=" + authorName.split(" ")[0];

    await page.goto(SCOPUS_SEARCH_URL + params, DIRECT_NAVIGATION_OPTIONS);
    await navigationPromise;
    console.log("navigate to scopus list authors ....")



    await page.waitForSelector("#srchResultsList", {
      timeout: 2000,
    });


    const authors = await page.evaluate(() => {
      const fieldsToProperties = (array) => ({
        name: array[0].split("\n")[0],
        documents: array[1],
        hIndex: array[2],
        affiliation: array[3],
        city: array[4],
        territory: array[5],
      });

      const htmlAuthors = [
        ...document
            .getElementById("srchResultsList")
            .querySelectorAll("tr.searchArea"),
      ];

      const authors = htmlAuthors.map((a) => {
        const htmlFields = [...a.querySelectorAll("td")];
        const fieldsArray = htmlFields.map((b) => b.textContent.trim());
        const link = a.querySelector("a") ? a.querySelector("a").href : "";
        const authorId = link.includes("authorID")
            ? link
                .split("&")
                .filter((a) => a.indexOf("authorID=") != -1)[0]
                .split("=")[1]
            : "";

        return {
          authorId,
          ...fieldsToProperties(fieldsArray),
          profilePicture: "",
          interests: [],
          link,
        };
      });

      return authors.filter(({ authorId }) => authorId);
    });

    return {
      authors: authors.map((author) => ({ ...author, platform: PLATFORM })),
    };
  } catch (error) {
    // console.error(error);
    return { error };
  } finally {
    await page.close();
    await browser.close();
    console.log("partie finally")
  }
};
const authorData = async ({ authorId }) => {
  const { browser, page } = await setupBrowserPage({
    allowedRequests: ["xhr", "script"],
  });

  try {
    await page.goto(
      SCOPUS_PROFILE_URL + "authorId=" + authorId,
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

    await page.waitForSelector(".highcharts-root path");

    let author = await page.evaluate(() => {
      const name = document
        .querySelector("#author-general-details > div > h2")
        .textContent.replace(",", "")
        .trim();
      
      const universityselector = document.querySelector("scopus-institution-name-link")
        var university='Affiliation non spécifièe';
      if(universityselector!=null){
      university=  universityselector.textContent.trim()
        .replace("disabled", "");
      }
      const interests = [
        ...document.querySelectorAll(
          ".button__text.text-bold.text--alight-left"
        ),
      ]
        .flatMap((a) => a.textContent.split(";"))
        .map((a) => a.trim());

            
   
      const publications = [
        ...document.querySelectorAll(
          "#scopus-author-profile-page-control-microui__documents-panel div.col-18.article--results els-results-view > els-results-view-list > ul > li> div"

        ),
      ]
        .map((a) => ({
          title: a.querySelector("h5").textContent.trim(),
          authors: [
            ...a.querySelectorAll("scopus-author-name-link a span"),
          ].map((b) => b.textContent.trim()),
          citation: a
            .querySelector(".col-2")
            .textContent.replace("Cited by", "")
            .replace("this link is disabled", "")
            .trim(),
          year: a
            .querySelector(".col-19 > div.text-width-34 > span:nth-child(2)")
            .textContent.trim(),
          source: a
            .querySelector(
              ".col-19 > div.text-width-34 > span.text-meta.text-bold.text-italic"
            )
            .textContent.trim(),
        }))
        .map((publication, index) => ({ index, ...publication }));

        const citations = [
          ...document.querySelectorAll("div.gsc_md_hist_b > a"),
        ].map((span) => span.textContent);
  
    
        
          const citationsPerYear = [
            ...document.querySelectorAll("div.highcharts-container > svg > g.highcharts-series-group > g.highcharts-markers.highcharts-series-1.highcharts-line-series.highcharts-tracker>path"),
          ].map((a) => a.attributes['aria-label'].value).map(
            (eaci) => eaci.split(".")[1].trim() 
          ).
          map((resu) => ({
            year: resu.split(",")[0].trim(),
            citations: resu.split(",")[1].trim(),
          }));
          const documentPerYear = [
            ...document.querySelectorAll("div.highcharts-container> svg > g.highcharts-series-group > g.highcharts-series.highcharts-series-0.highcharts-column-series.highcharts-tracker>rect"),
          ].map((a) => a.attributes['aria-label'].value).map(
            (eaci) => eaci.split(".")[1].trim() 
          ).
          map((resu) => ({
            year: resu.split(",")[0].trim(),
            documents: resu.split(",")[1].trim(),
          }));
      
      const indexesCitations = document.querySelector(
        "#scopus-author-profile-page-control-microui__ScopusAuthorProfilePageControlMicroui > div:nth-child(2) > div > micro-ui > scopus-author-details > section > div > div.col-lg-6.col-24 > section > div:nth-child(2) > h3"
      );

      const indexesHIndex = document.querySelector(
        "#scopus-author-profile-page-control-microui__ScopusAuthorProfilePageControlMicroui > div:nth-child(2) > div > micro-ui > scopus-author-details > section > div > div.col-lg-6.col-24 > section > div:nth-child(3) > h3"
      );

      const indexes = [
        {
          name: "citations",
          total: indexesCitations ? indexesCitations.textContent.trim() : "",
          lastFiveYears: indexesCitations
            ? citationsPerYear.reduce(
                (a, b) => a + parseInt(b["citations"] || 0),
                0
              )
            : 0,
        },
        {
          name: "h-index",
          total: indexesHIndex ? indexesHIndex.textContent.trim() : "",
          lastFiveYears: "",
        },
      ];
      const coauthors = [...document.querySelectorAll("div#gsc_rsb_co li")].map(
        (li) => ({
          name: li.getElementsByTagName("a")[0].textContent,
          profilePicture: li.getElementsByTagName("img")[0].src,
          bio: li.getElementsByTagName("a")[0].nextSibling.textContent,
        })
      );
      console.log(university);
      return {
        name,
        profilePicture: "",
        university ,
        email: "",
        indexes,
        interests,
        publications,
        coauthors,
        citationsPerYear,
        documentPerYear,
      };
    });

    if (!author) throw "Exception : No author data";

    return { author: { authorId, platform: PLATFORM, ...author } };
  } catch (error) {
    console.error(error);
    return { error };
  } finally {
    await page.close();
    await browser.close();
  }
};
module.exports = {
  authorSearch: performanceWrapping(authorSearch),
  authorData: performanceWrapping(authorData),
};
