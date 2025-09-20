import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MLSParserService } from './mls-parser.service';
import { ParsedMLSProperty } from './interfaces/mls-property.interface';
import { ConversationV2Service } from '../messaging/conversation-v2.service';

@Injectable()
export class BatchManagementService {
  constructor(
    private prisma: PrismaService,
    private mlsParser: MLSParserService,
    private conversationV2Service: ConversationV2Service,
  ) {}

  // Create a new property batch
  async createPropertyBatch(
    agentId: string,
    clientId: string,
    timelineId: string,
  ) {
    const batch = await this.prisma.propertyBatch.create({
      data: {
        agentId,
        clientId,
        timelineId,
        status: 'pending',
        totalProperties: 0,
        successCount: 0,
        failureCount: 0,
      },
    });

    return batch;
  }

  // Add MLS URLs to batch queue
  async addMLSUrlsToBatch(batchId: string, mlsUrls: string[]) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const batchProperties: any[] = [];

    for (let i = 0; i < mlsUrls.length; i++) {
      const mlsUrl = mlsUrls[i];

      batchProperties.push({
        batchId,
        mlsUrl,
        parseStatus: 'pending',
        position: i,
      });
    }

    await this.prisma.batchProperty.createMany({
      data: batchProperties,
    });

    // Update batch total
    await this.prisma.propertyBatch.update({
      where: { id: batchId },
      data: {
        totalProperties: mlsUrls.length,
      },
    });

    return this.getBatchWithProperties(batchId);
  }

  // Instant batch creation - creates properties immediately from URL, then parses in background
  async createInstantBatch(batchId: string) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
      include: {
        batchProperties: {
          where: { parseStatus: 'pending' },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    // Create properties with full parsing
    const properties = await this.createInstantProperties(
      batchId,
      batch.batchProperties,
    );

    return {
      success: true,
      message: 'Properties created successfully with full details',
      properties,
      instantCreationCompleted: true,
      parsingCompleted: true,
    };
  }

  // Create properties instantly from URL data
  private async createInstantProperties(
    batchId: string,
    batchProperties: any[],
  ) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const createdProperties: any[] = [];

    for (const batchProperty of batchProperties) {
      try {
        // Parse property data with full details immediately
        const result = await this.mlsParser.parseSingleMLS(
          batchProperty.mlsUrl,
        );

        let propertyData;

        if (result.success && result.data) {
          // Use parsed data if successful
          const urlData = this.parseUrlData(batchProperty.mlsUrl);
          propertyData = {
            timelineId: batch.timelineId,
            address:
              result.data.address?.full ||
              urlData.address ||
              'Address not found',
            city: result.data.address?.city || urlData.city || '',
            state: result.data.address?.state || urlData.state || '',
            zipCode: result.data.address?.zipCode || urlData.zipCode || '',
            price: result.data.pricing?.priceNumeric || 0,
            bedrooms: result.data.propertyDetails?.beds
              ? parseInt(result.data.propertyDetails.beds)
              : null,
            bathrooms: result.data.propertyDetails?.baths
              ? parseFloat(result.data.propertyDetails.baths)
              : null,
            squareFootage: result.data.propertyDetails?.sqft
              ? parseInt(
                  result.data.propertyDetails.sqft.replace(/[^0-9]/g, ''),
                )
              : null,
            description:
              (result.data.propertyDetails as any)?.description ||
              'No description available',
            imageUrls: JSON.stringify(result.data.images?.map((img) => img.url) || [
              'https://via.placeholder.com/400x300/e2e8f0/64748b?text=No+Image',
            ]),
            listingUrl: batchProperty.mlsUrl,
            position: batchProperty.position,
            batchId: batchId,
            originalMlsUrl: batchProperty.mlsUrl,
            parseTimestamp: new Date(),
            isQuickParsed: true,
            isFullyParsed: true,
            loadingProgress: 100,
            importStatus: 'pending',
          };
        } else {
          // Fallback to URL-based data if parsing fails
          const urlData = this.parseUrlData(batchProperty.mlsUrl);
          propertyData = {
            timelineId: batch.timelineId,
            address: urlData.address || 'Loading address...',
            city: urlData.city || '',
            state: urlData.state || '',
            zipCode: urlData.zipCode || '',
            price: 0,
            bedrooms: null,
            bathrooms: null,
            squareFootage: null,
            description: 'Property details could not be loaded',
            imageUrls: JSON.stringify([
              'https://via.placeholder.com/400x300/e2e8f0/64748b?text=Loading+Image',
            ]),
            listingUrl: batchProperty.mlsUrl,
            position: batchProperty.position,
            batchId: batchId,
            originalMlsUrl: batchProperty.mlsUrl,
            parseTimestamp: new Date(),
            isQuickParsed: false,
            isFullyParsed: false,
            loadingProgress: 50,
            importStatus: 'pending',
          };
        }

        // Create property with parsed data
        const property = await this.prisma.property.create({
          data: propertyData,
        });

        // Update batch property
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            propertyId: property.id,
            parseStatus: 'parsed',
            loadingProgress: 100,
          },
        });

        createdProperties.push(property);
      } catch (error) {
        console.error(
          `Failed to create instant property for ${batchProperty.mlsUrl}:`,
          error,
        );
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'failed',
            parseError: error.message,
            loadingProgress: 0,
          },
        });
      }
    }

    return createdProperties;
  }

  // Parse URL data instantly (no network requests)
  private parseUrlData(url: string) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      if (pathParts.length >= 4 && pathParts[1] === 'share') {
        const propertySlug = pathParts[3];
        const parts = propertySlug.split('-');

        if (parts.length >= 4) {
          const zipCode = parts[parts.length - 1];
          const state = parts[parts.length - 2];
          const city = parts[parts.length - 3]
            .replace(/([A-Z])/g, ' $1')
            .trim();
          const streetAddress = parts
            .slice(0, parts.length - 3)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          return {
            address: `${streetAddress}, ${city}, ${state} ${zipCode}`,
            city: city,
            state: state,
            zipCode: zipCode,
            shareId: pathParts[2],
          };
        }
      }

      return {
        address: 'Parsing property address...',
        city: '',
        state: '',
        zipCode: '',
      };
    } catch (error) {
      return {
        address: 'Error parsing URL',
        city: '',
        state: '',
        zipCode: '',
      };
    }
  }

  // Parse full details in background
  private async parseFullDetailsBackground(
    batchId: string,
    batchProperties: any[],
  ) {
    for (const batchProperty of batchProperties) {
      try {
        const current = await this.prisma.batchProperty.findUnique({
          where: { id: batchProperty.id },
          include: {
            property: true,
          },
        });

        if (!current?.propertyId || !current.property) {
          continue;
        }

        // Update progress to show parsing started
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'parsing',
            loadingProgress: 20,
          },
        });

        await this.prisma.property.update({
          where: { id: current.propertyId },
          data: { loadingProgress: 20 },
        });

        // Full parse with optimized settings
        const result = await this.mlsParser.parseSingleMLS(
          batchProperty.mlsUrl,
        );

        if (result.success && result.data) {
          // Update property with full data
          await this.prisma.property.update({
            where: { id: current.propertyId },
            data: {
              address: result.data.address?.full || current.property.address,
              city: result.data.address?.city || current.property.city,
              state: result.data.address?.state || current.property.state,
              zipCode: result.data.address?.zipCode || current.property.zipCode,
              price: result.data.pricing?.priceNumeric || 0,
              bedrooms: result.data.propertyDetails?.beds
                ? parseInt(result.data.propertyDetails.beds)
                : null,
              bathrooms: result.data.propertyDetails?.baths
                ? parseFloat(result.data.propertyDetails.baths)
                : null,
              squareFootage: result.data.propertyDetails?.sqft
                ? parseInt(
                    result.data.propertyDetails.sqft.replace(/[^0-9]/g, ''),
                  )
                : null,
              description: 'Loading property details...',
              propertyType: result.data.propertyDetails?.propertyType || null,
              imageUrls: JSON.stringify(result.data.images?.map((img) => img.url) || [
                'https://via.placeholder.com/400x300/e2e8f0/64748b?text=No+Image',
              ]),
              imageCount: result.data.images?.length || 0,
              parsedData: result.data as any,
              isFullyParsed: true,
              loadingProgress: 100,
            },
          });

          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'parsed',
              parsedData: result.data as any,
              loadingProgress: 100,
            },
          });
        } else {
          // Mark as failed but keep the instant property
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'failed',
              parseError: result.error,
              loadingProgress: 5, // Back to initial state
            },
          });
        }

        // Delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `Background parsing failed for ${batchProperty.mlsUrl}:`,
          error,
        );
      }
    }
  }

  // Progressive batch parsing - quick first, full details later
  async parseProgressiveBatch(batchId: string) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
      include: {
        batchProperties: {
          where: { parseStatus: 'pending' },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    // Phase 1: Quick parsing for immediate UI feedback
    await this.quickParseBatch(batchId, batch.batchProperties);

    // Phase 2: Full parsing in background (don't await)
    this.fullParseBatch(batchId, batch.batchProperties).catch((error) => {
      console.error('Background full parsing failed:', error);
    });

    return {
      success: true,
      message: 'Progressive parsing started',
      quickParsingCompleted: true,
      fullParsingInProgress: true,
    };
  }

  // Quick parsing phase - gets basic info fast for UI
  private async quickParseBatch(batchId: string, batchProperties: any[]) {
    for (const batchProperty of batchProperties) {
      try {
        // Update status to quick_parsing
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'quick_parsing',
            loadingProgress: 10,
          },
        });

        // Quick parse
        const result = await this.mlsParser.parseQuickMLS(batchProperty.mlsUrl);

        if (result.success && result.data) {
          // Store quick data
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'quick_parsed',
              quickData: result.data as any,
              loadingProgress: 40,
            },
          });

          // Create property with basic info
          await this.createQuickProperty(batchId, batchProperty, result.data);
        } else {
          // Mark as failed
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'failed',
              parseError: result.error,
              loadingProgress: 0,
            },
          });
        }
      } catch (error) {
        console.error(
          `Quick parsing failed for ${batchProperty.mlsUrl}:`,
          error,
        );
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'failed',
            parseError: error.message,
            loadingProgress: 0,
          },
        });
      }
    }
  }

  // Full parsing phase - gets all details in background
  private async fullParseBatch(batchId: string, batchProperties: any[]) {
    for (const batchProperty of batchProperties) {
      try {
        // Skip if quick parsing failed
        const current = await this.prisma.batchProperty.findUnique({
          where: { id: batchProperty.id },
        });

        if (current?.parseStatus !== 'quick_parsed') {
          continue;
        }

        // Update status to full parsing
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'full_parsing',
            loadingProgress: 60,
          },
        });

        // Full parse
        const result = await this.mlsParser.parseSingleMLS(
          batchProperty.mlsUrl,
        );

        if (result.success && result.data) {
          // Store full data and update property
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'parsed',
              parsedData: result.data as any,
              loadingProgress: 100,
            },
          });

          // Update property with full details
          if (current.propertyId) {
            await this.updatePropertyWithFullData(
              current.propertyId,
              result.data,
            );
          }
        } else {
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'failed',
              parseError: result.error,
              loadingProgress: 40, // Keep at quick parse level
            },
          });
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `Full parsing failed for ${batchProperty.mlsUrl}:`,
          error,
        );
      }
    }
  }

  // Create property with quick data
  private async createQuickProperty(
    batchId: string,
    batchProperty: any,
    quickData: any,
  ) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const property = await this.prisma.property.create({
      data: {
        timelineId: batch.timelineId,
        address: quickData.address?.full || 'Address parsing...',
        city: quickData.address?.city || '',
        state: quickData.address?.state || '',
        zipCode: quickData.address?.zipCode || '',
        price: quickData.pricing?.priceNumeric || 0,
        bedrooms: quickData.propertyDetails?.beds
          ? parseInt(quickData.propertyDetails.beds)
          : null,
        bathrooms: quickData.propertyDetails?.baths
          ? parseFloat(quickData.propertyDetails.baths)
          : null,
        squareFootage: quickData.propertyDetails?.sqft
          ? parseInt(quickData.propertyDetails.sqft.replace(/[^0-9]/g, ''))
          : null,
        imageUrls: JSON.stringify(quickData.images?.map((img) => img.url) || []),
        listingUrl: batchProperty.mlsUrl,
        position: batchProperty.position,
        batchId: batchId,
        originalMlsUrl: batchProperty.mlsUrl,
        parsedData: quickData,
        parseTimestamp: new Date(),
        isQuickParsed: true,
        isFullyParsed: false,
        loadingProgress: 40,
        importStatus: 'pending',
      },
    });

    // Link back to batch property
    await this.prisma.batchProperty.update({
      where: { id: batchProperty.id },
      data: { propertyId: property.id },
    });

    return property;
  }

  // Update property with full parsed data
  private async updatePropertyWithFullData(propertyId: string, fullData: any) {
    if (!propertyId) return;

    await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        address: fullData.address?.full || 'Address not found',
        city: fullData.address?.city || '',
        state: fullData.address?.state || '',
        zipCode: fullData.address?.zipCode || '',
        price: fullData.pricing?.priceNumeric || 0,
        bedrooms: fullData.propertyDetails?.beds
          ? parseInt(fullData.propertyDetails.beds)
          : null,
        bathrooms: fullData.propertyDetails?.baths
          ? parseFloat(fullData.propertyDetails.baths)
          : null,
        squareFootage: fullData.propertyDetails?.sqft
          ? parseInt(fullData.propertyDetails.sqft.replace(/[^0-9]/g, ''))
          : null,
        propertyType: fullData.propertyDetails?.propertyType || null,
        imageUrls: JSON.stringify(fullData.images?.map((img) => img.url) || []),
        imageCount: fullData.images?.length || 0,
        parsedData: fullData,
        isFullyParsed: true,
        loadingProgress: 100,
      },
    });
  }

  // Parse all URLs in a batch
  async parseBatchProperties(batchId: string) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
      include: {
        batchProperties: {
          where: { parseStatus: 'pending' },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    // Update batch status
    await this.prisma.propertyBatch.update({
      where: { id: batchId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    const results: any[] = [];

    for (const batchProperty of batch.batchProperties) {
      try {
        // Update status to parsing
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: { parseStatus: 'parsing' },
        });

        // Parse MLS URL
        const parseResult = await this.mlsParser.parseSingleMLS(
          batchProperty.mlsUrl,
        );

        if (parseResult.success && parseResult.data) {
          // Check for duplicates
          const duplicateCheck = await this.mlsParser.checkEnhancedDuplicate(
            batch.agentId,
            batch.clientId,
            parseResult.data,
          );

          if (duplicateCheck.isDuplicate) {
            await this.prisma.batchProperty.update({
              where: { id: batchProperty.id },
              data: {
                parseStatus: 'failed',
                parseError: `Duplicate: ${duplicateCheck.reason}`,
              },
            });

            results.push({
              id: batchProperty.id,
              success: false,
              error: `Duplicate: ${duplicateCheck.reason}`,
              isDuplicate: true,
            });
          } else {
            // Store parsed data
            await this.prisma.batchProperty.update({
              where: { id: batchProperty.id },
              data: {
                parseStatus: 'parsed',
                parsedData: parseResult.data as any,
              },
            });

            results.push({
              id: batchProperty.id,
              success: true,
              data: parseResult.data,
            });
          }
        } else {
          // Store parse error
          await this.prisma.batchProperty.update({
            where: { id: batchProperty.id },
            data: {
              parseStatus: 'failed',
              parseError: parseResult.error,
            },
          });

          results.push({
            id: batchProperty.id,
            success: false,
            error: parseResult.error,
          });
        }
      } catch (error) {
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'failed',
            parseError: error.message,
          },
        });

        results.push({
          id: batchProperty.id,
          success: false,
          error: error.message,
        });
      }

      // Small delay between parses
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Update batch completion status
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await this.prisma.propertyBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        successCount,
        failureCount,
      },
    });

    return {
      batchId,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    };
  }

  // Import parsed properties to timeline
  async importParsedProperties(
    batchId: string,
    propertyImports: {
      batchPropertyId: string;
      customDescription?: string;
      agentNotes?: string;
      customBeds?: string;
      customBaths?: string;
      customSqft?: string;
    }[],
  ) {
    const batch = await this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
      include: {
        timeline: true,
        batchProperties: {
          where: {
            id: { in: propertyImports.map((p) => p.batchPropertyId) },
            parseStatus: 'parsed',
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const importResults: any[] = [];

    for (const importData of propertyImports) {
      const batchProperty = batch.batchProperties.find(
        (bp) => bp.id === importData.batchPropertyId,
      );

      if (!batchProperty || !batchProperty.parsedData) {
        importResults.push({
          batchPropertyId: importData.batchPropertyId,
          success: false,
          error: 'Property not found or not parsed',
        });
        continue;
      }

      try {
        const parsedData =
          batchProperty.parsedData as unknown as ParsedMLSProperty;

        // Get last position in timeline
        const lastProperty = await this.prisma.property.findFirst({
          where: { timelineId: batch.timelineId },
          orderBy: { position: 'desc' },
        });

        const nextPosition = (lastProperty?.position || 0) + 1;

        // Create property
        const newProperty = await this.prisma.property.create({
          data: {
            address: parsedData.address.full,
            city: parsedData.address.city,
            state: parsedData.address.state,
            zipCode: parsedData.address.zipCode,
            price: parsedData.pricing?.priceNumeric || 0,
            bedrooms: importData.customBeds
              ? parseInt(importData.customBeds)
              : parsedData.propertyDetails.beds
                ? parseInt(parsedData.propertyDetails.beds)
                : null,
            bathrooms: importData.customBaths
              ? parseFloat(importData.customBaths)
              : parsedData.propertyDetails.baths
                ? parseFloat(parsedData.propertyDetails.baths)
                : null,
            squareFootage: importData.customSqft
              ? parseInt(importData.customSqft.replace(/[^0-9]/g, ''))
              : parsedData.propertyDetails.sqft
                ? parseInt(
                    parsedData.propertyDetails.sqft.replace(/[^0-9]/g, ''),
                  )
                : null,
            description:
              importData.customDescription ||
              `${importData.customBeds || parsedData.propertyDetails.beds || ''} bed${(importData.customBeds || parsedData.propertyDetails.beds) !== '1' ? 's' : ''}, ${importData.customBaths || parsedData.propertyDetails.baths || ''} bath${(importData.customBaths || parsedData.propertyDetails.baths) !== '1' ? 's' : ''}, ${importData.customSqft || parsedData.propertyDetails.sqft || ''} sqft`,
            imageUrls: JSON.stringify(parsedData.images.map((img) => img.url)),
            listingUrl: parsedData.sourceUrl,

            // MLS metadata
            mlsSource: 'flexmls',
            originalMlsUrl: parsedData.sourceUrl,
            parsedData: parsedData as any,
            parseTimestamp: parsedData.scrapedAt,
            imageCount: parsedData.images.length,
            addressNormalized: this.normalizeAddress(parsedData.address.full),
            priceRange: this.getPriceRange(
              parsedData.pricing?.priceNumeric || 0,
            ),

            // Timeline data
            timelineId: batch.timelineId,
            position: nextPosition,
            batchId: batchId,
            importStatus: 'completed',

            // Agent data
            agentNotes: importData.agentNotes,
          },
        });

        // Create V2 conversation for this property automatically
        let conversationId: string | null = null;
        try {
          const conversation = await this.conversationV2Service.getOrCreatePropertyConversation({
            propertyId: newProperty.id,
            timelineId: batch.timelineId,
            agentId: batch.agentId,
            clientId: batch.clientId,
          });
          conversationId = conversation.id;
          console.log(`✅ Created PropertyConversation ${conversationId} for property ${newProperty.id} during batch import`);
        } catch (error) {
          console.warn('Conversation creation failed during batch import:', error.message);
        }

        // Update batch property
        await this.prisma.batchProperty.update({
          where: { id: batchProperty.id },
          data: {
            parseStatus: 'imported',
            propertyId: newProperty.id,
          },
        });

        importResults.push({
          batchPropertyId: importData.batchPropertyId,
          success: true,
          propertyId: newProperty.id,
          address: newProperty.address,
          conversationId: conversationId,
        });
      } catch (error) {
        importResults.push({
          batchPropertyId: importData.batchPropertyId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      batchId,
      importResults,
      summary: {
        total: propertyImports.length,
        successful: importResults.filter((r) => r.success).length,
        failed: importResults.filter((r) => !r.success).length,
      },
    };
  }

  // Get batch with properties
  async getBatchWithProperties(batchId: string) {
    return this.prisma.propertyBatch.findUnique({
      where: { id: batchId },
      include: {
        batchProperties: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  // Helper methods
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getPriceRange(price: number): string {
    if (price < 200000) return 'under_200k';
    if (price < 300000) return '200k_300k';
    if (price < 500000) return '300k_500k';
    if (price < 750000) return '500k_750k';
    if (price < 1000000) return '750k_1m';
    return 'over_1m';
  }

  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
    return isNaN(num) ? undefined : num;
  }

  private parseFloat(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value.replace(/[^\d.]/g, ''));
    return isNaN(num) ? undefined : num;
  }
}
