import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = "data:" + file.mimetype + ";base64," + b64;
    return cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto',
      folder: 'riva/users',
    });
  }
  async deleteImage(publicId: string): Promise<any> {
    return cloudinary.uploader.destroy(publicId);
  }
}
