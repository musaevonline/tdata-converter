import { SqliteService } from './sqlite.service';
import { Module } from '@nestjs/common';
@Module({
  imports: [],
  providers: [SqliteService],
  exports: [SqliteService],
})
export class SqliteModule {}
