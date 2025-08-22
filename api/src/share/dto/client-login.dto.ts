import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class ClientLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  clientName: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'Phone last four must be exactly 4 digits' })
  phoneLastFour: string;
}
