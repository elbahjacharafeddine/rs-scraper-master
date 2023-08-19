const { scimagojrScraper, greensciScraper ,scopusScraper} = require("../scraper");

const journalData = async (journalName,year, ws) => {

  try {
    const scimagojrResult = await scimagojrScraper.journalData({
      journalName,
      year,
    });

    // const greensciResult = await greensciScraper.journalData({
    //   journalName,
    //   year,
    // });
    let journal
    if (
        (scimagojrResult.journal && scimagojrResult.journal.SJR)
        // ||
        // (greensciResult.journal && greensciResult.journal.IF)
    ){
      console.log("we will send the response")

      ws.send(JSON.stringify(
          journal= {
            SJR:
                scimagojrResult.journal && scimagojrResult.journal.SJR
                    ? scimagojrResult.journal.SJR
                    : "",
            // IF:
            //   greensciResult.journal && greensciResult.journal.IF
            //     ? greensciResult.journal.IF
            //     : "",
          },
      ));

    }
    // else if (greensciResult.journal.error) {
    //   resp
    //     .status(200)
    //     .send({
    //       error: { ...scimagojrResult.journal, ...greensciResult.journal },
    //     });
    // }
    else {
      ws.send(JSON.stringify(journal={
        SJR:"-"
      }))
    }
  }
  catch (error){
    ws.send(JSON.stringify(journal={
      SJR:""
    }))
  }
};

const journalDataByHttp = async (req, resp) => {
  const { journalName, year } = req.params;

  if (!journalName) {
    resp.status(200).send({ error: "No journal name" });
    return;
  }

  const scimagojrResult = await scimagojrScraper.journalData({
    journalName,
    year,
  });


  if (scimagojrResult.journal && scimagojrResult.journal.SJR)
    resp.send({
      journal: {
        SJR:
            scimagojrResult.journal && scimagojrResult.journal.SJR
                ? scimagojrResult.journal.SJR
                : ""
      },
    });
   else {
    resp.status(500).send({ error: "Unhandled error" });
  }
};

module.exports = { journalData, journalDataByHttp };
