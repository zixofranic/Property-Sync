import {
  IsArray,
  IsString,
  IsUrl,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class ParseMLSUrlsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10) // Limit to 10 URLs at once
  @IsUrl({}, { each: true })
  mlsUrls: string[];
}

export class ParseSingleMLSDto {
  @IsString()
  @IsUrl()
  mlsUrl: string;
}
