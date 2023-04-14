import { ArchivesModule } from './archives/archives.module';
import { CloudsModule } from './clouds/clouds.module';
import { SqliteModule } from './sqlite/sqlite.module';
import { ConverterModule } from './converter/converter.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  imports: [ConverterModule, CloudsModule, ArchivesModule, SqliteModule],
  controllers: [AppController],
})
export class AppModule {}
