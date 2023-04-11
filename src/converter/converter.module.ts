import { Module } from '@nestjs/common';
import { ConverterService } from './converter.service';

@Module({
  imports: [],
  providers: [ConverterService],
  exports: [ConverterService],
})
export class ConverterModule {}
