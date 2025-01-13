const express = require('express');
const cors = require('cors');
const { createBlob, deleteBlob, getBlobs } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Files data (use an in-memory store or a database in production)
let filesData = {};

// Routes
app.get('/', (req, res) => {
    res.send(`
        <h1>File Upload Server with Vercel Blob</h1>
        <p>Endpoints available:</p>
        <ul>
            <li><strong>POST /upload</strong>: Upload a file</li>
            <li><strong>GET /get-files</strong>: Retrieve a list of uploaded files</li>
            <li><strong>DELETE /delete-file</strong>: Delete a file</li>
        </ul>
    `);
});

// Upload route
app.post('/upload', async (req, res) => {
    try {
        const { file, page } = req.body;
        if (!file || !page) {
            return res.status(400).json({ message: 'File or page is missing!' });
        }

        // Create a blob in Vercel Blob storage
        const buffer = Buffer.from(file, 'base64'); // Assuming the file is sent as a base64 string
        const { url, name } = await createBlob(buffer);

        if (!filesData[page]) filesData[page] = [];
        filesData[page].push({ name, url });

        res.status(200).json({
            message: 'File uploaded successfully!',
            fileName: name,
            fileUrl: url,
        });
    } catch (error) {
        console.error('Error uploading file:', error.message);
        res.status(500).json({ message: 'Error uploading file.', error: error.message });
    }
});

// Get files route
app.get('/get-files', (req, res) => {
    const { page } = req.query;

    if (!filesData[page]) {
        return res.status(200).json([]);
    }

    res.status(200).json(filesData[page]);
});

// Delete file route
app.delete('/delete-file', async (req, res) => {
    try {
        const { page, fileName } = req.body;

        if (!page || !fileName) {
            return res.status(400).json({ message: 'Page or file name is missing!' });
        }

        if (!filesData[page]) {
            return res.status(404).json({ message: 'Page not found.' });
        }

        const fileIndex = filesData[page].findIndex(file => file.name === fileName);
        if (fileIndex === -1) {
            return res.status(404).json({ message: 'File not found.' });
        }

        const fileUrl = filesData[page][fileIndex].url;

        // Delete the blob from Vercel Blob storage
        await deleteBlob(fileName);

        filesData[page].splice(fileIndex, 1);

        res.status(200).json({ message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Error deleting file:', error.message);
        res.status(500).json({ message: 'Error deleting file.', error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
