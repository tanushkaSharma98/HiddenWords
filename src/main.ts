import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

    app.enableCors({
    origin: ['http://localhost:3000','http://127.0.0.1:5500', 'http://localhost:5500'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true })); //applies a global validation pipe to all incoming HTTP requests.

  app.useWebSocketAdapter(new IoAdapter(app));

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
