import { SqliteService } from './sqlite/sqlite.service.js';
import { ConverterService } from './converter/converter.service.js';
import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

export interface IConvertDto {
  urls: string[];
}

@Controller()
export class AppController {
  constructor(
    private readonly converterService: ConverterService,
    private readonly sqliteService: SqliteService,
  ) {}

  @Post('/convert')
  @UseInterceptors(FilesInterceptor('files'))
  async convert(
    @Body() body: IConvertDto,
    @UploadedFiles() uploadedFiles: Array<Express.Multer.File>,
  ) {
    const files = uploadedFiles.map((file) => file.buffer);
    const urls = Array.isArray(body.urls)
      ? body.urls
      : [body.urls].filter(Boolean);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (url.startsWith('https://disk.yandex.ru/')) {
        const file = await this.converterService.downloadFromYandex(url);
        files.push(file);
      } else if (url.startsWith('https://mega.nz/')) {
        const file = await this.converterService.downloadFromMega(url);
        files.push(file);
      } else if (url.startsWith('https://drive.google.com/')) {
        const file = await this.converterService.downloadFromDrive(url);
        files.push(file);
      }
    }

    const result: Array<{ name: string; buffer: Buffer | string }> = [];
    for (let i = 0; i < files.length; i++) {
      const archive = files[i];
      const archiveFiles = await this.converterService.uncompress(archive);
      const { keyFile, baseFile } =
        this.converterService.getFiles(archiveFiles);
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
