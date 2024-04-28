const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const { YoutubeTranscript } = require("youtube-transcript");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

// Enable CORS for all routes and origins
app.use(cors());
app.use(express.json()); // for parsing application/json

const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate-pdf", async (req, res) => {
  const { htmlContent } = req.body;

  const styledhtmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");
* {
  font-family: "Inter", sans-serif;
  line-height: 1.5;
  letter-spacing: 0.5px;
}

ul, ol {
  list-style-position: inside;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

li {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
p {
  margin-top: 1rem;
  margin-bottom: 1rem;
}
</style>
</head>
<body>
    ${htmlContent}
</body>
</html>
`;

  // const browser = await puppeteer.launch();
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ignoreHTTPSErrors: true,
    dumpio: false
  });

  const page = await browser.newPage();
  await page.setContent(styledhtmlContent, { waitUntil: "networkidle0" });
  //   const pdfBuffer = await page.pdf({ format: 'A4' });
  const pdfBuffer = await page.pdf({
    path: "output.pdf",
    format: "A4",
    margin: {
      top: "20mm",
      right: "10mm",
      bottom: "20mm",
      left: "10mm",
    },
  });

  await browser.close();

  // Send PDF as a response
  res.contentType("application/pdf");
  res.send(pdfBuffer);
});

app.post("/chatgpt", async (req, res) => {
  try {
    const { prompt, previousMessages } = req.body;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        ...previousMessages,
        {
          role: "system",
          content: "You are ChatGPT, a large language model trained by OpenAI.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res
      .status(200)
      .json({ message: response.choices[0].message.content });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "An error occurred while processing your request",
      details: error.message, // You might want to be more cautious about what error details you send back
    });
  }
});

app.post("/youtube", async (req, res) => {
  const { url } = req.body;
  YoutubeTranscript.fetchTranscript(url)
    .then((transcript) => {
      // Assuming the transcript is in the same format as the array above.
      const textOnly = transcript.map((segment) => segment.text).join(" ");
      res.status(200).json({ transcript: textOnly }); // Send the text-only transcript as a JSON response.
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "An error occurred while fetching the transcript" });
    });
});

app.get("/", async (req, res) => {
  return res.status(200).send("Backend APIs");
});

app.listen(port, () => {
  console.log(`PDF generation service running at http://localhost:${port}`);
});
