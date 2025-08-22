export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string = 'Bearer';
  expiresIn: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    emailVerified: boolean;
  };
}
