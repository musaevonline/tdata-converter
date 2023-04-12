import { SqliteModule } from './sqlite/sqlite.module';
import { ConverterModule } from './converter/converter.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConverterModule, SqliteModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
