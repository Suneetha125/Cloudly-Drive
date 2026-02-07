const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

// This connects to your MinIO (or AWS)
const s3Client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
    forcePathStyle: true, // Required for MinIO
    region: "us-east-1", 
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    },
});

module.exports = s3Client;