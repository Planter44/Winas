const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

if (isCloudinaryConfigured()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const uploadBuffer = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', ...options },
            (err, result) => {
                if (err) return reject(err);
                return resolve(result);
            }
        );

        stream.end(buffer);
    });
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadBuffer
};
