import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MLSParserService } from './mls-parser.service';
import { ParseMLSUrlsDto, ParseSingleMLSDto } from './dto/parse-mls-urls.dto';
import { BatchImportPropertiesDto } from './dto/batch-import-properties.dto';

@Controller('api/v1/mls')
@UseGuards(JwtAuthGuard)
export class MLSParserController {
  constructor(private readonly mlsParserService: MLSParserService) {}

  // Parse a single MLS URL quickly (basic info only)
  @Post('parse-single-quick')
  async parseSingleQuick(@Request() req, @Body() parseDto: ParseSingleMLSDto) {
    try {
      const result = await this.mlsParserService.parseQuickMLS(parseDto.mlsUrl);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          mlsUrl: result.mlsUrl,
        };
      }

      // Check for duplicates
      const agentId = req.user.id;
      const { clientId } = req.query;

      if (clientId && result.data) {
        const duplicateCheck =
          await this.mlsParserService.checkEnhancedDuplicate(
            agentId,
            clientId,
            result.data,
          );

        if (duplicateCheck.isDuplicate) {
          return {
            success: false,
            error: `Duplicate property: ${duplicateCheck.reason}`,
            isDuplicate: true,
            existingProperty: duplicateCheck.existingProperty,
            mlsUrl: result.mlsUrl,
          };
        }
      }

      return {
        success: true,
        data: result.data,
        mlsUrl: result.mlsUrl,
        isQuickParse: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mlsUrl: parseDto.mlsUrl,
      };
    }
  }

  // Parse a single MLS URL (full details)
  @Post('parse-single')
  async parseSingle(@Request() req, @Body() parseDto: ParseSingleMLSDto) {
    try {
      const result = await this.mlsParserService.parseSingleMLS(
        parseDto.mlsUrl,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          mlsUrl: result.mlsUrl,
        };
      }

      // Check for duplicates
      const agentId = req.user.id;
      const { clientId } = req.query;

      if (clientId && result.data) {
        const duplicateCheck =
          await this.mlsParserService.checkEnhancedDuplicate(
            agentId,
            clientId,
            result.data,
          );

        if (duplicateCheck.isDuplicate) {
          return {
            success: false,
            error: `Duplicate property: ${duplicateCheck.reason}`,
            isDuplicate: true,
            existingProperty: duplicateCheck.existingProperty,
            mlsUrl: result.mlsUrl,
          };
        }
      }

      return {
        success: true,
        data: result.data,
        mlsUrl: result.mlsUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mlsUrl: parseDto.mlsUrl,
      };
    }
  }

  // Parse multiple MLS URLs
  @Post('parse-batch')
  async parseBatch(
    @Request() req,
    @Body() parseDto: ParseMLSUrlsDto,
    @Query('clientId') clientId?: string,
  ) {
    try {
      const agentId = req.user.id;
      const results = await this.mlsParserService.parseBatchMLS(
        parseDto.mlsUrls,
      );

      // Check duplicates for successful parses
      const enhancedResults: any[] = [];

      for (const result of results) {
        if (result.success && clientId && result.data) {
          const duplicateCheck =
            await this.mlsParserService.checkEnhancedDuplicate(
              agentId,
              clientId,
              result.data,
            );

          enhancedResults.push({
            ...result,
            isDuplicate: duplicateCheck.isDuplicate,
            duplicateReason: duplicateCheck.reason,
            existingProperty: duplicateCheck.existingProperty,
          });
        } else {
          enhancedResults.push(result);
        }
      }

      const successCount = enhancedResults.filter(
        (r) => r.success && !r.isDuplicate,
      ).length;
      const duplicateCount = enhancedResults.filter(
        (r) => r.isDuplicate,
      ).length;
      const errorCount = enhancedResults.filter((r) => !r.success).length;

      return {
        success: true,
        results: enhancedResults,
        summary: {
          total: parseDto.mlsUrls.length,
          successful: successCount,
          duplicates: duplicateCount,
          errors: errorCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
