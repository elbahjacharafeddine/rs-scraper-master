const {clarivateScraper} = require("../scraper");


const getIFF = async (req, res) => {
    const { journalName } = req.params;
    const year =2023


    console.log(journalName);

    const result = await clarivateScraper.journalData(journalName)
    console.log(result)
    res.send(result)
}



module.exports = {getIFF};
