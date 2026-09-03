import { v2 as cloudinary } from 'cloudinary';
import { Provider } from '@nestjs/common';

export const CloudinaryProvider: Provider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    return cloudinary.config({
      cloud_name: process.env.CLOUDNAIRY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDNAIRY_API_KEY || process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDNAIRY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });
  },
};
