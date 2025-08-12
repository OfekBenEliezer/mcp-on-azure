require('dotenv').config();
const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const axios = require('axios');

const app = express();
app.use(express.json());

const containerName = 'captain-azure';
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

app.post('/tools/list_captain_files', async (req, res) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobNames = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      blobNames.push(blob.name);
    }

    res.json({ files: blobNames });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/describe_blob', async (req, res) => {
  try {
    const { blobName } = req.body;

    if (!blobName) {
      return res.status(400).json({ error: 'Missing blobName in request body' });
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const blobUrl = blockBlobClient.url;

    const endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

    const response = await axios.post(
      endpoint,
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe the image in a short, clear sentence." },
              { type: "image_url", image_url: { url: blobUrl } }
            ]
          }
        ],
        temperature: 0.5,
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        }
      }
    );

    const description = response.data.choices[0].message.content;
    res.json({ description });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3333, () => {
  console.log('MCP Server running on http://localhost:3333');
});
