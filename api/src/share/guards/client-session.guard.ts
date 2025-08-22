import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ShareService } from '../share.service';

@Injectable()
export class ClientSessionGuard implements CanActivate {
  constructor(private shareService: ShareService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken =
      request.headers['x-session-token'] || request.body.sessionToken;

    if (!sessionToken) {
      throw new UnauthorizedException('Session token required');
    }

    const isValid = await this.shareService.validateClientSession(sessionToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return true;
  }
}
