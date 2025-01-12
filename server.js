const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const uploadsPath = path.join(__dirname, 'uploads');
const filesJsonPath = path.join(__dirname, 'files.json');

// Ensure the uploads folder exists
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}

// Ensure the files.json file exists
if (!fs.existsSync(filesJsonPath)) {
    fs.writeFileSync(filesJsonPath, '{}');
}

// Multer storage configuration for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); // Ensure UTF-8 encoding
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads and front-end assets)
app.use('/uploads', express.static(uploadsPath));
app.use(express.static('public'));

// Routes
// Root route
app.get('/', (req, res) => {
    res.send(`
        <h1>File Upload Server</h1>
        <p>Endpoints available:</p>
        <ul>
            <li><strong>POST /upload</strong>: Upload a file</li>
            <li><strong>GET /get-files</strong>: Retrieve a list of uploaded files</li>
            <li><strong>DELETE /delete-file</strong>: Delete a file</li>
            <li><strong>Access files:</strong> http://localhost:${PORT}/uploads/filename</li>
        </ul>
    `);
});

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded!' });
    }

    const { page } = req.body; // Get the target page from the request
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const savedFileName = req.file.filename;

    // Read files.json and update it
    let filesData = {};
    try {
        filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    } catch (error) {
        console.error('Error reading files.json:', error.message);
    }

    if (!filesData[page]) {
        filesData[page] = [];
    }
    filesData[page].push({
        name: originalName,
        path: `/uploads/${savedFileName}`,
    });

    fs.writeFileSync(filesJsonPath, JSON.stringify(filesData, null, 2));

    res.status(200).json({
        message: 'File uploaded successfully!',
        filePath: `/uploads/${savedFileName}`,
        originalName,
    });
});

// Retrieve files route
app.get('/get-files', (req, res) => {
    const { page } = req.query;

    let filesData = {};
    try {
        filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    } catch (error) {
        console.error('Error reading files.json:', error.message);
    }

    if (!filesData[page]) {
        return res.status(200).json([]);
    }

    res.status(200).json(filesData[page]);
});

// DELETE file route
app.delete('/delete-file', (req, res) => {
    const { page, fileName } = req.body;

    if (!page || !fileName) {
        return res.status(400).json({ success: false, message: 'Page or file name is missing.' });
    }

    let filesData = {};
    try {
        filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    } catch (error) {
        console.error('Error reading files.json:', error.message);
        return res.status(500).json({ success: false, message: 'Error reading files data.' });
    }

    if (!filesData[page]) {
        return res.status(404).json({ success: false, message: 'Page not found.' });
    }

    const fileIndex = filesData[page].findIndex(file => file.name === fileName);
    if (fileIndex === -1) {
        return res.status(404).json({ success: false, message: 'File not found.' });
    }

    const filePath = path.join(__dirname, filesData[page][fileIndex].path);
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err.message);
            return res.status(500).json({ success: false, message: 'Error deleting file.' });
        }

        filesData[page].splice(fileIndex, 1);
        fs.writeFileSync(filesJsonPath, JSON.stringify(filesData, null, 2));

        res.status(200).json({ success: true, message: 'File deleted successfully.' });
    });
});

// Handle 404 - Not Found
app.use((req, res) => {
    res.status(404).send('404 - Not Found');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
