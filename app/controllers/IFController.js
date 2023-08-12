const { bioxbioScraper} = require("../scraper");


const getIF = async (req, resp) => {
    const { source } = req.params;


    console.log(source);
     
    const bioxbio = await bioxbioScraper.IFData({source});
    const { author } = bioxbio;
      console.log(JSON.stringify({author}))
      resp.send({ author });
}
   


module.exports = {getIF};
