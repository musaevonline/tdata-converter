import { CloudsService } from './clouds.service';
import { Module } from '@nestjs/common';
@Module({
  imports: [],
  providers: [CloudsService],
  exports: [CloudsService],
})
export class CloudsModule {}
