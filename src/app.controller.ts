import { ConverterService } from './converter/converter.service';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly converterService: ConverterService) {
    this.getHello();
  }

  @Get()
  async getHello() {
    const url = `https://disk.yandex.ru/d/AAwL1lywNKDYtQ`;
    const zip = await this.converterService.downloadFromYandex(url);
    const files = await this.converterService.unzip(zip);
    const { keyFile, baseFile } = this.converterService.getFiles(files);
    const session = await this.converterService.convert(keyFile, baseFile);
    console.log(session);
  }
}
