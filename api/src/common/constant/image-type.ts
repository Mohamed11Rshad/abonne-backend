import { ApiProperty } from '@nestjs/swagger';

export class ImageType {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../image.jpg' })
  secure_url: string;

  @ApiProperty({ example: 'sample_folder/sample_image' })
  public_id: string;
}