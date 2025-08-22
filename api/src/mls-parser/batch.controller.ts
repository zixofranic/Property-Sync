import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BatchManagementService } from './batch-management.service';
import { BatchImportPropertiesDto } from './dto/batch-import-properties.dto';

@Controller('api/v1/batch')
@UseGuards(JwtAuthGuard)
export class BatchController {
  constructor(private readonly batchService: BatchManagementService) {}

  // Create new property batch
  @Post('create')
  async createBatch(
    @Request() req,
    @Body() createData: { clientId: string; timelineId: string },
  ) {
    const agentId = req.user.id;
    return this.batchService.createPropertyBatch(
      agentId,
      createData.clientId,
      createData.timelineId,
    );
  }

  // Add MLS URLs to batch
  @Post(':batchId/add-urls')
  async addUrls(
    @Param('batchId') batchId: string,
    @Body() urlData: { mlsUrls: string[] },
  ) {
    return this.batchService.addMLSUrlsToBatch(batchId, urlData.mlsUrls);
  }

  // Create properties instantly from URL, then parse in background
  @Post(':batchId/create-instant')
  async createInstantBatch(@Param('batchId') batchId: string) {
    return this.batchService.createInstantBatch(batchId);
  }

  // Parse batch properties progressively (quick first, full later)
  @Post(':batchId/parse-progressive')
  async parseProgressiveBatch(@Param('batchId') batchId: string) {
    return this.batchService.parseProgressiveBatch(batchId);
  }

  // Parse all URLs in batch (original method)
  @Post(':batchId/parse')
  async parseBatch(@Param('batchId') batchId: string) {
    return this.batchService.parseBatchProperties(batchId);
  }

  // Import parsed properties
  @Post(':batchId/import')
  async importProperties(
    @Param('batchId') batchId: string,
    @Body() importData: BatchImportPropertiesDto,
  ) {
    return this.batchService.importParsedProperties(
      batchId,
      importData.properties,
    );
  }

  // Get batch status
  @Get(':batchId')
  async getBatch(@Param('batchId') batchId: string) {
    return this.batchService.getBatchWithProperties(batchId);
  }
}
