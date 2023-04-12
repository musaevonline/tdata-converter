import {  } from './sqlite.service';
import { Module } from '@nestjs/common';
import { AppService } from './app.service';

@Module({
  imports: [ConverterModule],
  providers: [AppService],
})
export class AppModule {}
