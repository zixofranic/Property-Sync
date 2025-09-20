import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      'http://localhost:3007',
      'http://localhost:3008',
      'http://localhost:3009',
      'http://localhost:3010',
      'http://localhost:3011',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      'http://127.0.0.1:3004',
      'http://127.0.0.1:3005',
      'http://127.0.0.1:3006',
      'http://127.0.0.1:3007',
      'http://127.0.0.1:3008',
      'http://127.0.0.1:3009',
      'http://127.0.0.1:3010',
      'http://127.0.0.1:3011',
      'http://192.168.1.209:3000',
      'http://192.168.1.209:3001',
      'http://192.168.1.209:3002',
      'http://192.168.1.209:3003',
      'http://192.168.1.209:3004',
      'http://192.168.1.209:3005',
      'http://192.168.1.209:3006',
      'http://192.168.1.209:3007',
      'http://192.168.1.209:3008',
      'http://192.168.1.209:3009',
      'http://192.168.1.209:3010',
      'http://192.168.1.209:3011',
      'https://property-sync-mu.vercel.app',
      'https://property-sync.com',
      'https://www.property-sync.com',
      /https:\/\/.*\.vercel\.app$/,
      /https:\/\/.*\.up\.railway\.app$/,
    ],
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
  console.log(`🔄 Starting application on port ${port}...`);
  console.log(`📡 Health check endpoint: /api/health`);
  console.log(`🗄️ Database URL configured: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on port ${port}`);
}
bootstrap();
