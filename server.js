
const express = require('express');
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");

const app = express();
const WebSocket = require('ws');
const https = require('https');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://80a12083a1774420b431700d1d2cf56f@o433230.ingest.sentry.io/5387943' });
// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());
app.use(cors());


app.use("/screenshots", express.static(__dirname + "/public/screenshots"));

const router = require("./routes");
const {authorsController, journalsController} = require("./app/controllers");
app.use("/", router);
// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// app.listen(process.env.PORT || 2000, () =>
//   console.log("Server started on port :", process.env.PORT || 2000)
// );

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 2000
server.listen(process.env.PORT || port,  () => {
    console.log(`Server started on http://localhost:${port}`);

});

wss.on('connection', async (ws) => {


    console.log('WebSocket connection established');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.authorId){
            await authorsController.author(data.authorId,ws)
        }
        else if(data.journalName && data.year){
            console.log(data.journalName +" && year = "+data.year)
            // await journalsController.journalData(data.journalName, data.year, ws)


            const [SJR, IF] = await Promise.all([
                executeThread('Scopus',data.journalName,data.year),
                executeThread('Clarivate',data.journalName.toUpperCase(),data.year)
                //
            ]);

            ws.send(JSON.stringify(
                journal= {
                    SJR, IF
                },
            ));

        }
        else if(data.authorName){
            console.log("Le nom de l'auteur est : "+data.authorName)
            await authorsController.authorSearch(data.authorName, ws)
        }
    })})


app.get('/prof/scopus/:authorId',async (req, res) =>{
    const {authorId} = req.params
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        // Définir l'en-tête User-Agent personnalisé
        await page.setUserAgent('Chrome/96.0.4664.93');
        await page.setDefaultNavigationTimeout(85000);
        // await page.waitForFunction(() => document.readyState === 'complete');
        // const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });

        await page.goto('https://www.scopus.com/authid/detail.uri?authorId=' + authorId);
        // await navigationPromise; // Wait for the DOM content to be fully loaded

        console.log('navigation to scopus...')

        // await page.waitForSelector('#scopus-author-profile-page-control-microui__general-information-content',{timeout:4000});

        // await page.waitForSelector('.container .AuthorProfilePageControl-module__sgqt5',{ timeout: 3000 })
        // page.waitForTimeout(1000)
        // const name = await page.$eval('#scopus-author-profile-page-control-microui_general-information-content > div.Col-module_hwM1N.offset-lg-2 > div > h1 > strong', (e) => e.textContent.trim().replace(',',''))
        const name =''
        // await page.waitForSelector('#scopus-author-profile-page-control-microui__general-information-content')
        // const univer = await page.$eval('#scopus-author-profile-page-control-microui_general-information-content > div.Col-modulehwM1N.offset-lg-2 > ul > li.AuthorHeader-moduleDRxsE > span > a > span.Typography-modulelVnit.Typography-moduleNfgvc.Button-module_Imdmt', (e) => e.textContent.trim())
        const univer =''
        let h_index=''

        try {
            h_index = await page.$eval("#scopus-author-profile-page-control-microui_general-information-content > div.Col-modulehwM1N.offset-lg-2 > section > div > div:nth-child(3) > div > div > div:nth-child(1) > span.Typography-modulelVnit.Typography-moduleix7bs.Typography-module_Nfgvc",(e) =>e.textContent)
        }catch (error){
            console.log("")
        }
        const interests = []

        await page.waitForTimeout(1000);
        console.log('start scrolling...')
        await autoScroll(page);
        console.log('End of scrolling...')
        await page.waitForTimeout(1500);
        const publications = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.ViewType-module__tdc9K li'), (e) => ({
                title:e.querySelector('h4 span').innerText,
                authors: Array.from((new Set(Array.from(e.querySelectorAll('.author-list span'), (authorElement) => authorElement.innerText)))),
                citation : e.querySelector('.col-3 span:nth-child(1)').innerText,
                year:e.querySelector('.text-meta span:nth-child(2)').innerText.replace('this link is disabled',"").substring(0,4),
                source:e.querySelector('span.text-bold').innerText,
            })));

        const allPath = await page.evaluate(() => Array.from(document.querySelectorAll('path[aria-label]'), (e) => e.getAttribute('aria-label')));


        const citationsPerYear = allPath.map(item => {
            const [yearString, citationsString] = item.split(':');
            const year = parseInt(yearString.trim());
            const citations = parseInt(citationsString.trim());

            return { year, citations };
        });
        const totalCitations = citationsPerYear.reduce((acc, item) => acc + item.citations, 0);
        const indexes = [
            {
                name: "citations",
                total: totalCitations,
                lastFiveYears: "",
            },
            {
                name: "h-index",
                total: h_index,
                lastFiveYears: "",
            },
        ];

        // await page.waitForTimeout(1000);


        const author ={
            name,
            profilePicture: "",
            univer,
            email: "",
            indexes,
            interests,
            publications,
            coauthors: [],
            citationsPerYear,
        };
//
        // res.header('Access-Control-Allow-Origin', 'https://rs-client-master.vercel.app');
        res.send({ "author": { authorId, platform: "scopus", ...author } });
        console.log("the response has been sent")


    } catch (error) {
        console.error('Une erreur s\'est produite :', error);
    }
    finally {
        let pages = await browser.pages();
        await Promise.all(pages.map(page =>page.close()));
        await browser.close()
    }
})




async function executeThread(platform,journal, year) {
    return new Promise(async (resolve) => {
        const worker = new Worker('./scraper.js', { workerData: { platform, journal, year } });

        worker.on('message', (message) => {
            resolve(message);
        });

        worker.on('error', (error) => {
            console.error(`Worker error: ${error}`);
            resolve(null);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
        });
    });
}







let browser;
const puppeteer = require('puppeteer')
// Function to launch the Puppeteer browser if not already launched.
async function getBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        userDataDir: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    return browser;
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 80;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    })
}

async function scrapDataforUser(authorId){
    const browser = await getBrowser();
    const page = await browser.newPage();
    const dataScraping = []

    try {
        await page.setUserAgent('Chrome/96.0.4664.93');
        await page.setDefaultNavigationTimeout(85000);

        await page.goto('https://www.scopus.com/authid/detail.uri?authorId=' + authorId);

        console.log('navigation to scopus...')

        await page.waitForSelector('#scopus-author-profile-page-control-microui__general-information-content',{timeout:4000});

        await page.waitForTimeout(1000);
        console.log('start scrolling...')
        await autoScroll(page);
        console.log('End of scrolling...')
        await page.waitForTimeout(1500);
        const publications = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.ViewType-module__tdc9K li'), (e) => ({
                title:e.querySelector('h4 span').innerText,
                authors: Array.from((new Set(Array.from(e.querySelectorAll('.author-list span'), (authorElement) => authorElement.innerText)))),
                citation : e.querySelector('.col-3 span:nth-child(1)').innerText,
                year:e.querySelector('.text-meta span:nth-child(2)').innerText.replace('this link is disabled',"").substring(0,4),
                source:e.querySelector('span.text-bold').innerText,
            })));

        const author ={
            authorId : authorId,
            publications,
        };

        dataScraping.push(author)

        console.log(dataScraping[0].publications)
    } catch (error) {
        console.error('Une erreur s\'est produite :', error);
    }
    finally {
        let pages = await browser.pages();
        await Promise.all(pages.map(page =>page.close()));
        await browser.close()
    }
}