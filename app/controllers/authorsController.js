const fs = require("fs");
// const { scholarScraper, scopusScraper } = require("./../scraper");
const {json} = require("express");
var getDirName = require("path").dirname;
const puppeteer = require('puppeteer')
const {scopusScraper} = require("../scraper");

const AUTHOR_STORAGE_PATH = "app/storage/authors/";
let res ={
  step:'Recherchons dans la base ',
  plateforme :"SCOPUS",
  color:'white',
  background:'orange'
}
const response ={res:res}

let browser;
async function getBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    userDataDir: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}

async function goToErressource(page) {
  await page.goto('https://eressources.imist.ma/login');
  await page.type('#email', 'lachgar.m@ucd.ac.ma');
  await page.type('#password', 'Azerty@@00');
  // LEv.q8XeGxP2Pid
  await Promise.all([
    page.waitForNavigation(), // Wait for the navigation to complete after clicking the login button.
    page.click('button[type="submit"]'),
  ]);
  console.log("Authentication with success ... ");
}
async function autoScroll(page){
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
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
  });
}


const authorSearch = async (req, resp) => {
  const { authorName } = req.params;

  if (!authorName) {
    resp.status(200).send({ error: "No author name" });
    return;
  }
  console.log('we start search ')
  // const scholarAuthors = await scholarScraper.authorSearch({ authorName });
  const scopusAuthors = await scopusScraper.authorSearch({ authorName });

  // if (scholarAuthors.error && scopusAuthors.error) {
  //   resp.status(200).send({
  //     error: { scholar: scholarAuthors.error, scopus: scopusAuthors.error },
  //   });
  // }

  if ( scopusAuthors.authors) {
    const authors = [
      // ...(scholarAuthors.authors ? scholarAuthors.authors : []),
      ...(scopusAuthors.authors ? scopusAuthors.authors : []),
    ];
    resp.send({ authors });
  }
};

const author = async (authorId, ws) => {
  console.log(authorId +" is the id received from serveur")
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Définir l'en-tête User-Agent personnalisé
    await page.setUserAgent('Chrome/96.0.4664.93');
    await page.setDefaultNavigationTimeout(85000);
    // await page.waitForFunction(() => document.readyState === 'complete');
    const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    await goToErressource(page)
    ws.send(JSON.stringify(response))
    await page.goto('https://www-scopus-com.eressources.imist.ma/authid/detail.uri?authorId=' + authorId);
    await navigationPromise; // Wait for the DOM content to be fully loaded
    console.log('navigation to scopus...')

    await page.waitForTimeout(1500)
    try {
      await page.waitForSelector('#scopus-author-profile-page-control-microui__general-information-content', {timeout: 4000});
    }
    catch (error){

    }

    const name = await page.$eval('#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > div > h1 > strong', (e) => e.textContent.trim().replace(',', ''))
    let univer=''
    try {
      univer = await page.$eval('#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > ul > li.AuthorHeader-module__DRxsE > span > a > span.Typography-module__lVnit.Typography-module__Nfgvc.Button-module__Imdmt', (e) => e.textContent.trim())
    }catch (e) {
      console.log('university not found ...')
    }

    let h_index = ''
    // console.log("start time out")

    await page.waitForTimeout(1000)
    try {
      h_index = await page.$eval("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(3) > div > div > div:nth-child(1) > span", (e) => e.textContent)
    } catch (error) {
      console.log(error)
    }
    // page.waitForTimeout(9000)
    // console.log("fin time out")
    const interests = []

    console.log('start scrolling...')
    await autoScroll(page);
    console.log('End of scrolling...')


    let publications =[]
    const allPath = await page.evaluate(() => Array.from(document.querySelectorAll('path[aria-label]'), (e) => e.getAttribute('aria-label')));
    const citationsPerYear = allPath.map(item => {
      const [yearString, citationsString] = item.split(':');
      const year = parseInt(yearString.trim());
      const citations = parseInt(citationsString.trim());

      return {year, citations};
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

    console.log("good elbahja")
    const authorr ={
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
    const author = {"author": {authorId, platform: "scopus", ...authorr}}

    async function extractPublicationDetails(element) {
      const publication = await element.evaluate((e) => {
        return {
          title: e.querySelector('h4 span').innerText,
          authors: Array.from(new Set(Array.from(e.querySelectorAll('.author-list span'), (authorElement) => authorElement.innerText))),
          citation: e.querySelector('.col-3 span:nth-child(1)').innerText,
          year: e.querySelector('.text-meta span:nth-child(2)').innerText.replace('this link is disabled', '').substring(0, 4),
          source: e.querySelector('span.text-bold').innerText,
        };
      });

      publications.push(publication);

      await ws.send(JSON.stringify(author));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }



    await page.waitForSelector('.ViewType-module__tdc9K li');
    const elements = await page.$$('.ViewType-module__tdc9K li');
    for (const element of elements) {
      await extractPublicationDetails(element);
    }

    const paginationLink = await page.$$('.micro-ui-namespace els-paginator li');
    paginationLink.shift()
    paginationLink.shift()
    paginationLink.pop()

    for(const e of paginationLink){
      console.log("element is clicked ...!")
      await e.click()
      await page.waitForTimeout(1500)

      await page.waitForSelector('.ViewType-module__tdc9K li');
      const elements = await page.$$('.ViewType-module__tdc9K li');
      for (const element of elements) {
        await extractPublicationDetails(element);
      }
    }
    console.log("the response has been sent")
    const fin = {
      fin :true,
    }
    ws.send(JSON.stringify(fin))
  // await page.close()
  }
  catch (error) {
    console.log("************  erreur  ************")
    const message ={state:"erreur"}
    console.log(error)
    ws.send(JSON.stringify(message))
    const fin = {
      fin :false,
    }
    ws.send(JSON.stringify(fin))
  }
  finally {
    await page.close()
    await browser.close();

  }


};

module.exports = { authorSearch, author };