// Import dependencies
const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// AWS S3 configuration
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Multer-S3 storage configuration
const upload = multer({
    storage: multerS3({
        s3,
        bucket: process.env.AWS_BUCKET_NAME,
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            const category = req.body.category || 'general';
            const timestamp = Date.now();
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            cb(null, `${category}/${timestamp}-${originalName}`);
        },
    }),
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static frontend files

// Routes

// Upload file endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
    const { file, body } = req;
    const { page } = body;  // Category selected from the dropdown
  
    if (!file || !page) {
      return res.status(400).send('No file uploaded or category not selected.');
    }
  
    try {
      // Upload the file to the "General" or selected category folder on S3
      const params = {
        Bucket: 'tamkeen-bucket', // Your S3 bucket name
        Key: `${page}/${file.originalname}`, // Save under selected category
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // or other access control list as per your need
      };
  
      const command = new PutObjectCommand(params);
      await s3.send(command); // Upload the file to S3
  
      res.status(200).send({ success: true, fileName: file.originalname });
    } catch (err) {
      res.status(500).send({ message: 'Error uploading file.', error: err });
    }
  });
  
// Get files in a specific category
app.get('/get-files', async (req, res) => {
    const { page } = req.query;
  
    if (!page) {
      return res.status(400).send('No category provided.');
    }
  
    try {
      const params = {
        Bucket: 'tamkeen-bucket', // Your S3 bucket name
        Prefix: `${page}/`, // Folder in S3 based on the selected category
      };
  
      const command = new ListObjectsV2Command(params);
      const data = await s3.send(command); // Fetch files
  
      // Extract only file names from the result
      const files = data.Contents.map(file => ({
        name: file.Key.replace(`${page}/`, '')  // Remove the category part of the file path
      }));
  
      res.json(files);
    } catch (err) {
      res.status(500).send({ message: 'Error fetching files.', error: err });
    }
  });

  // Delete file endpoint
app.delete('/delete-file', async (req, res) => {
    const { page, fileName } = req.body;
  
    if (!fileName || !page) {
      return res.status(400).send('Missing file name or category.');
    }
  
    try {
      const params = {
        Bucket: 'tamkeen-bucket', // Your S3 bucket name
        Key: `${page}/${fileName}`, // File path in selected category
      };
  
      const command = new DeleteObjectCommand(params);
      await s3.send(command); // Delete the file from S3
  
      res.status(200).send({ success: true });
    } catch (err) {
      res.status(500).send({ message: 'Error deleting file.', error: err });
    }
  });

// Serve index.html from public directory for frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404 - Not Found
app.use((req, res) => {
    res.status(404).send('404 - Not Found');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});