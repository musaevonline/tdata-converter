import { ArchivesService } from './archives.service';
import { Module } from '@nestjs/common';
@Module({
  imports: [],
  providers: [ArchivesService],
  exports: [ArchivesService],
})
export class ArchivesModule {}
