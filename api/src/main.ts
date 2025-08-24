import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow all origins in production for now
      if (!origin || 
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') ||
          origin.includes('vercel.app') ||
          origin.includes('railway.app') ||
          origin.includes('192.168.1.209')) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(null, true); // Allow all for now
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on port ${port}`);
}
bootstrap();
