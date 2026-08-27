import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SortDto {
  @ApiPropertyOptional({
    description:
      'Sort fields as a comma-separated list. Prefix with "-" for descending order.',
    example: '-createdAt,name',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
