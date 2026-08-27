import { Type } from '@nestjs/common';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { SortDto } from './sort.dto';

const BaseFilterFields: Type<PaginationDto & SortDto> = IntersectionType(
  PaginationDto,
  SortDto,
);

export class BaseFilterDto extends BaseFilterFields {
  @ApiPropertyOptional({
    description: 'Full-text search keyword',
    example: 'search keyword',
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
