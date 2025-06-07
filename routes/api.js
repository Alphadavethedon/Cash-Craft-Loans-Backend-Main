const express = require('express');
const router = express.Router();
const unirest = require("unirest");
app.use('/api/loans', require('./routes/loanRoutes'));
// Add this endpoint
router.get('/get-safaricom-token', async (req, res) => {
  try {
    const response = await unirest("GET", "https://sandbox.safaricom.co.ke/oauth/v1/generate")
      .query({ "grant_type": "client_credentials" })
      .headers({
        "Authorization": "Basic SWZPREdqdkdYM0FjWkFTcTdSa1RWZ2FTSklNY001RGQ6WUp4ZVcxMTZaV0dGNFIzaA=="
      });
    
    res.json(response.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;