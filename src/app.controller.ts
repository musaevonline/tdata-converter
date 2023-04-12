import { SqliteService } from './sqlite/sqlite.service';
import { ConverterService } from './converter/converter.service';
import { Body, Controller, Post } from '@nestjs/common';

export interface IConvertDto {
  urls: string[];
  archives: string[];
}

@Controller()
export class AppController {
  constructor(
    private readonly converterService: ConverterService,
    private readonly sqliteService: SqliteService,
  ) {
    this.convert();
  }

  @Post()
  async convert() {
    const urls = 'https://disk.yandex.ru/d/zDM_lIypm0kp4w'.split('\n');
    const result: Array<{ name: string; buffer: Buffer | string }> = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const zip = await this.converterService.downloadFromYandex(url);
      const files = await this.converterService.unzip(zip);
      const { keyFile, baseFile } = this.converterService.getFiles(files);
      const session = await this.converterService.convert(keyFile, baseFile);
      const sqlite = this.sqliteService.buildSession(
        session.dcId,
        session.serverAddress,
        session.port,
        session.authKey.getKey(),
      );

      result.push({ name: `${i}.session`, buffer: sqlite });
      result.push({
        name: `${i}.json`,
        buffer: JSON.stringify({
          apiId: 2496,
          apiHash: '8da85b0d5bfe62527e5b244c209159c3',
          deviceModel: 'PC',
          systemVersion: 'Windows 10',
          appVersion: '2.7.1',
          serverAddress: session.serverAddress,
          dcId: session.dcId,
          port: session.port,
        }),
      });
    }
    const resultZip = await this.converterService.zip(result);
    return resultZip;
  }
}
