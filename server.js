const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, deleteObject, getDownloadURL } = require('firebase/storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store metadata in files.json
const filesJsonPath = path.join(__dirname, 'files.json');
if (!fs.existsSync(filesJsonPath)) {
    fs.writeFileSync(filesJsonPath, '{}');
}

// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded!' });
        }

        const { page } = req.body;
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const timestamp = Date.now();
        const fileName = `${timestamp}-${originalName}`;

        // Create a reference to the file in Firebase Storage
        const storageRef = ref(storage, `uploads/${fileName}`);

        // Upload the file
        await uploadBytes(storageRef, req.file.buffer);

        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Update files.json
        let filesData = {};
        try {
            filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
        } catch (error) {
            console.error('Error reading files.json:', error);
            filesData = {};
        }

        if (!filesData[page]) {
            filesData[page] = [];
        }

        filesData[page].push({
            name: originalName,
            path: `uploads/${fileName}`,
            url: downloadURL,
            uploadedAt: new Date().toISOString()
        });

        fs.writeFileSync(filesJsonPath, JSON.stringify(filesData, null, 2));

        res.status(200).json({
            message: 'File uploaded successfully!',
            url: downloadURL,
            originalName
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Get files route
app.get('/get-files', (req, res) => {
    const { page } = req.query;

    let filesData = {};
    try {
        filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    } catch (error) {
        console.error('Error reading files.json:', error);
    }

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
            return res.status(400).json({ success: false, message: 'Page or file name is missing.' });
        }

        let filesData = {};
        try {
            filesData = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
        } catch (error) {
            console.error('Error reading files.json:', error);
            return res.status(500).json({ success: false, message: 'Error reading files data.' });
        }

        if (!filesData[page]) {
            return res.status(404).json({ success: false, message: 'Page not found.' });
        }

        const fileIndex = filesData[page].findIndex(file => file.name === fileName);
        if (fileIndex === -1) {
            return res.status(404).json({ success: false, message: 'File not found.' });
        }

        // Delete from Firebase Storage
        const storageRef = ref(storage, filesData[page][fileIndex].path);
        await deleteObject(storageRef);

        // Update files.json
        filesData[page].splice(fileIndex, 1);
        fs.writeFileSync(filesJsonPath, JSON.stringify(filesData, null, 2));

        res.status(200).json({ success: true, message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, message: 'Error deleting file.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});