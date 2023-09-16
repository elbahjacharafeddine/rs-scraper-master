const { workerData, parentPort } = require('worker_threads');
const puppeteer = require('puppeteer');

const platform = workerData.platform;
const year = workerData.year
const journal = workerData.journal

const fs = require('fs').promises
const {authorsController, journalsController} = require("./app/controllers");

let vide = true




async function scrapeScopus() {

    return await journalsController.journalData(journal, year, undefined);
}

async function scrapeClarivate() {
    return await gotoClarivate(journal, year)
}


if (platform === 'Scopus') {
    scrapeScopus().then((data) => {
        parentPort.postMessage(data);
    });
}
else if (platform === 'Clarivate') {

    scrapeClarivate().then((data) => {
        parentPort.postMessage(data);
    });
}




async function gotoClarivate(journal, year) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = 'cookies.txt'; // Spécifiez le chemin du fichier contenant les cookies.

    try {
        let cookies = [];

        // Utilisez fs.promises.readFile pour lire le fichier de manière asynchrone.
        const data = await fs.readFile(filePath, 'utf8');

        if (data.length > 0) {
            cookies = JSON.parse(data);
        } else {
            await page.goto("https://eressources.imist.ma/login")
            await page.type('#email', 'e-elbahja.c@ucd.ma'); //e-elbahja.c@ucd.ma // lachgar.m@ucd.ac.ma
            await page.type('#password', 'LEv.q8XeGxP2Pid'); //LEv.q8XeGxP2Pid // Azerty@@00
            await Promise.all([
                page.waitForNavigation(), // Wait for the navigation to complete after clicking the login button.
                page.click('button[type="submit"]'),
            ]);
            console.log("Authentication with success ... ");

            const cookiesErressource = await page.cookies()
            const cookiesJson = JSON.stringify(cookiesErressource,null,2)

            await fs.writeFile(filePath, cookiesJson, (err) => {
                if (err) {
                    console.log("error when writing in the file")
                } else {
                    console.log("good thanks ")
                }
            })
        }

        await page.setCookie(...cookies);
        console.log('Cookies ont été ajoutés avec succès.');

        await page.setDefaultNavigationTimeout(85000);
        await page.goto("https://jcr.clarivate.com.eressources.imist.ma/jcr-jp/journal-profile?journal=" + journal + "&year=" + year);

        await page.waitForTimeout(3000);
        console.log("Début du défilement");
        await autoScrollToPercentage(page, 70);
        console.log("Fin du défilement");

        const datta = await page.evaluate(() => {
            const tableRows = Array.from(document.querySelectorAll('.incites-jcr3-fe-journal-profile-page-root .incites-jcr3-fe-journal-profile .journals-performance-section .incites-jcr3-fe-rank-by-jif .carousel-container table tr'));
            return tableRows.map(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    return {
                        year: cells[0].textContent.trim(),
                        quartile: cells[2].textContent.trim(),
                    };
                }
                else {
                    console.log('not > then 2')
                }
                return null; // Return null for rows with unexpected cell count.
            }).filter(item => item !== null); // Remove null entries.
        });


        let quartileIF = "-";
        datta.forEach((e) => {
            if (e.year == year) {
                quartileIF = e.quartile;
            }
        });
        return quartileIF;
    } catch (e) {
        console.log("Erreur : " + e);
    } finally {
        await browser.close(); // Assurez-vous de fermer le navigateur en fin de traitement.
    }
}
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


