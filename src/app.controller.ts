import { ConverterService } from './converter/converter.service';
import { Body, Controller, Post } from '@nestjs/common';

export interface IConvertDto {
  urls: string[];
  archives: string[];
}

@Controller()
export class AppController {
  constructor(private readonly converterService: ConverterService) {}

  @Post()
  async convert(@Body() body: IConvertDto) {
    for (let i = 0; i < body.urls.length; i++) {
      const url = body.urls[i];
      const zip = await this.converterService.downloadFromYandex(url);
      const files = await this.converterService.unzip(zip);
      const { keyFile, baseFile } = this.converterService.getFiles(files);
      const session = await this.converterService.convert(keyFile, baseFile);
    }
  }
}
