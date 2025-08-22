import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('api/v1/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() createClientDto: CreateClientDto) {
    const agentId = req.user.id;
    return this.clientsService.create(agentId, createClientDto);
  }

  @Get()
  async findAll(@Request() req) {
    const agentId = req.user.id;
    return this.clientsService.findAll(agentId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const agentId = req.user.id;
    return this.clientsService.findOne(agentId, id);
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    const agentId = req.user.id;
    return this.clientsService.update(agentId, id, updateClientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req, @Param('id') id: string) {
    const agentId = req.user.id;
    return this.clientsService.remove(agentId, id);
  }
}
