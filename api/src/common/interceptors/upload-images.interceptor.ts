import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Type, NestInterceptor, BadRequestException } from '@nestjs/common';
import { MulterField } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const UploadImagesInterceptor = (
  fields: MulterField[],
  customOptions?: MulterOptions,
): Type<NestInterceptor> => {
  return FileFieldsInterceptor(fields, {
    storage: memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return callback(
          new BadRequestException('local.common.INVALID_IMAGE_TYPE'),
          false,
        );
      }
      callback(null, true);
    },
    ...customOptions,
  });
}
