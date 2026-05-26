const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "drinkedin/posts",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1080, height: 1080, crop: "limit", quality: "auto" }]
  }
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "drinkedin/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto" }]
  }
});

const imageFilter = (req, file, cb) => {
  file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only image files allowed"), false);
};

const uploadPostImage = multer({ storage: postStorage,  fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatar    = multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 3 * 1024 * 1024 } });

module.exports = { uploadPostImage, uploadAvatar };