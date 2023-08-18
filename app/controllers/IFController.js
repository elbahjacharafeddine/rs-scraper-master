const jsonfile = require("jsonfile");
const fs = require("fs");

const { performanceWrapping } = require("../scraper/helper/performanceWrapping");
const { setupBrowserPage } = require("../scraper/helper/setupBrowserPage");
const puppeteer = require("puppeteer");

const CLARIVATE_LOGIN_URL = "https://mjl.clarivate.com/login";
const CLARIVATE_LOGIN_FRAME_URL =
    "https://access.clarivate.com/login?app=censub";
const JOURNAL_BUTTON_SELECTOR_FIRST_PART =
    "body > cdx-app > mat-sidenav-container > mat-sidenav-content > main > can-home-page > div > div > div > mat-sidenav-container > mat-sidenav-content > app-journal-search-results > div:nth-child(3) > div:nth-child(";
const JOURNAL_BUTTON_SELECTOR_SECOND_PART =
    ") > mat-card > mat-card-content:nth-child(4) > div > div > div:nth-child(1) > div:nth-child(2) > button";

const EMAIL_INPUT_SELECTOR = "#mat-input-0";
const PASSWORD_INPUT_SELECTOR = "#mat-input-1";
const CLARIVATE_ACCOUNT_EMAIL = "elbahjacharafeddine2020@gmail.com";
console.log(CLARIVATE_ACCOUNT_EMAIL);
const CLARIVATE_ACCOUNT_PASSWORD = "36SDrAmhQ9-rp!2";
console.log(CLARIVATE_ACCOUNT_PASSWORD);
const LOGIN_BUTTON_SELECTOR =
    "#signIn-btn > span.mat-button-wrapper > span:nth-child(1)";
const SEARCH_INPUT_SELECTOR = "#search-box";
const SEARCH_BUTTON_SELECTOR = "#search-button";
const SEARCH_RESULT_CARD_SELECTOR =
    "body > cdx-app > mat-sidenav-container > mat-sidenav-content > main > can-home-page > div > div > div > mat-sidenav-container > mat-sidenav-content > app-journal-search-results > div:nth-child(3) > div";
const IF_VALUE_SPAN_SELECTOR = "#minicard-body-value-lg";

const SEARCH_RESULT_CARD_TITLE_SELECTOR = "mat-card-title";
const WRITE_COOKIES_OBJECT_ERROR_MESSAGE = "The file could not be written.";
const WRITE_COOKIES_OBJECT_SUCCESS_MESSAGE =
    "Session has been successfully saved";

const NO_MATCHING_JOURNALS_EXCEPTION_MESSAGE =
    "No matching journals in CLARIVATE";
const COOKIES_FILE_PATH = "./cookiesObject.json";

const DIRECT_NAVIGATION_OPTIONS = {
    waitUntil: "load",
    timeout: 0,
};

const autoScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    });
};

let browser;
async function getBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        userDataDir: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    return browser;
}

const getIF = async (req, resp) => {
    const { journalName,year } = req.params;
    //
    //
    console.log(journalName);
    console.log(year)
    // const { browser, page } = await setupBrowserPage({
    //     allowedRequests: ["script", "xhr"],
    //     useNativePuppeteer: true,
    // });
    const browser = await getBrowser()
    const page = await browser.newPage()

    try {
        await page.goto(CLARIVATE_LOGIN_URL, DIRECT_NAVIGATION_OPTIONS);
        await page.setCookie();

        await autoScroll(page);

        const frame = page
            .frames()
            .find((frame) => frame.url() === CLARIVATE_LOGIN_FRAME_URL);

        try {
            await page.waitForSelector("#onetrust-close-btn-container > button");
            await page.hover("#onetrust-close-btn-container > button");

            await page.click("#onetrust-close-btn-container > button");
        }
        catch (error){
            console.log("erreur de cookies")
        }
        await page.waitForTimeout(1000)
        await frame.waitForSelector(EMAIL_INPUT_SELECTOR);
        await frame.type(EMAIL_INPUT_SELECTOR, CLARIVATE_ACCOUNT_EMAIL);



        await frame.waitForSelector(PASSWORD_INPUT_SELECTOR);
        await frame.type(PASSWORD_INPUT_SELECTOR, CLARIVATE_ACCOUNT_PASSWORD);



        await frame.waitForSelector(LOGIN_BUTTON_SELECTOR);
        await frame.hover(LOGIN_BUTTON_SELECTOR);

        await autoScroll(page);

        await frame.click(LOGIN_BUTTON_SELECTOR);





        await page.waitForNavigation();

        await autoScroll(page);

        await page.waitForSelector(SEARCH_INPUT_SELECTOR);
        await page.type(SEARCH_INPUT_SELECTOR, journalName);
    //
        await page.waitForSelector(SEARCH_BUTTON_SELECTOR);
        await page.hover(SEARCH_BUTTON_SELECTOR);
        await page.click(SEARCH_BUTTON_SELECTOR);

        await page.waitForNavigation();

        await page.waitForSelector(SEARCH_RESULT_CARD_SELECTOR);
    //
        const matchingJournals = await page.evaluate(
            async (SEARCH_RESULT_CARD_SELECTOR, SEARCH_RESULT_CARD_TITLE_SELECTOR) =>
                [...document.querySelectorAll(SEARCH_RESULT_CARD_SELECTOR)].map(
                    (cardHtml) => ({
                        title: cardHtml.querySelector(SEARCH_RESULT_CARD_TITLE_SELECTOR)
                            ? cardHtml.querySelector(SEARCH_RESULT_CARD_TITLE_SELECTOR)
                                .textContent
                            : "",
                    })
                ),
            SEARCH_RESULT_CARD_SELECTOR,
            SEARCH_RESULT_CARD_TITLE_SELECTOR
        );

        const results = matchingJournals
            .map((journal, index) => ({ ...journal, index }))
            .filter(
                ({ title }) =>
                    title.toLowerCase().trim() === journalName.toLowerCase().trim()
            );

        if (results.length === 0)
            throw new Error(NO_MATCHING_JOURNALS_EXCEPTION_MESSAGE);

        const index = results[0].index + 1;

        const JOURNAL_BUTTON_SELECTOR =
            JOURNAL_BUTTON_SELECTOR_FIRST_PART +
            index +
            JOURNAL_BUTTON_SELECTOR_SECOND_PART;

        await page.waitForSelector(JOURNAL_BUTTON_SELECTOR);

        await page.hover(JOURNAL_BUTTON_SELECTOR);
        await page.click(JOURNAL_BUTTON_SELECTOR);

        await page.waitForTimeout(1000)
        await page.waitForSelector(IF_VALUE_SPAN_SELECTOR, { timeout: 5000 });
        const firstIF = await page.$(IF_VALUE_SPAN_SELECTOR);
        const IF = await page.evaluate((element) => element.textContent, firstIF);



        await page.waitForSelector("#jciSubcardContent > div > div.subcard-body > div > div.minicard-container-left.minicard-separator > div.minicard-head", { timeout: 5000 });
        const firstYear = await page.$("#jciSubcardContent > div > div.subcard-body > div > div.minicard-container-left.minicard-separator > div.minicard-head");
        const FYear = await page.evaluate((element) => element.textContent, firstYear);



        await page.waitForSelector("#jciSubcardContent > div > div.subcard-body > div > div.minicard-container-right > div.minicard-body >div.minicard-body-value-lg", { timeout: 5000 });
        const secondIF = await page.$('#jciSubcardContent > div > div.subcard-body > div > div.minicard-container-right > div.minicard-body >div.minicard-body-value-lg');
        const IFS = await page.evaluate((element) => element.textContent, secondIF);



        await page.waitForSelector("#jifSubcardUnentitled > mat-card-content > div > div.subcard-body > div > div.minicard-container-right > div.minicard-head", { timeout: 5000 });
        const secondYear = await page.$("#jifSubcardUnentitled > mat-card-content > div > div.subcard-body > div > div.minicard-container-right > div.minicard-head");
        const SYear = await page.evaluate((element) => element.textContent, secondYear);


        if(parseInt(year) >= parseInt(FYear)){
            resp.status(200).send({ journal: { IF } })
        }
        else if(parseInt(year) < parseInt(FYear) && parseInt(year) >= parseInt(SYear)){
            resp.status(200).send({ journal: { IF:IFS } })
        }
        else {
            resp.status(200).send({ journal: { IF:IFS } })
        }


    } catch (error) {
        console.error(error);
    }
    finally {
        await page.close();
        await browser.close();
    }
};
   


module.exports = {getIF};
