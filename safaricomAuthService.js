const unirest = require("unirest");

const generateAuthToken = async () => {
  try {
    const response = await unirest("GET", "https://sandbox.safaricom.co.ke/oauth/v1/generate")
      .query({ "grant_type": "client_credentials" })
      .headers({
        "Authorization": "Basic SWZPREdqdkdYM0FjWkFTcTdSa1RWZ2FTSklNY001RGQ6WUp4ZVcxMTZaV0dGNFIzaA=="
      });
    
    return response.body.access_token;
  } catch (error) {
    console.error("Safaricom Auth Error:", error);
    throw error;
  }
};

module.exports = { generateAuthToken };