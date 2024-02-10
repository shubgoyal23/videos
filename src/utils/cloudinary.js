import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (imagePath) => {
  try {
    if (!imagePath) return null;
    const result = await cloudinary.uploader.upload(imagePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(imagePath);
    return result;
  } catch (error) {
    console.error(error);
    fs.unlinkSync(imagePath);
  }
};

export {uploadOnCloudinary};
