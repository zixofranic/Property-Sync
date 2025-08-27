import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AgentService } from './agent.service';

@Controller('api/v1/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // Get public agent profile by shareToken
  @Public()
  @Get(':shareToken')
  async getPublicAgentProfile(@Param('shareToken') shareToken: string) {
    const agent = await this.agentService.getAgentByShareToken(shareToken);
    
    if (!agent) {
      throw new NotFoundException('Agent profile not found');
    }

    return {
      data: agent,
      error: null,
      message: 'Agent profile retrieved successfully'
    };
  }
}