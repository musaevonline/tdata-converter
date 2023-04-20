import { CloudsService } from './clouds/clouds.service';
import { ArchivesService } from './archives/archives.service';
import { SqliteService } from './sqlite/sqlite.service.js';
import { ConverterService } from './converter/converter.service.js';
import {
  Body,
  Controller,
  HttpException,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IFile } from './app.interface';

export interface IConvertDto {
  urls: string[];
}

@Controller()
export class AppController {
  constructor(
    private readonly converterService: ConverterService,
    private readonly cloudsService: CloudsService,
    private readonly archivesService: ArchivesService,
    private readonly sqliteService: SqliteService,
  ) {}

  @Post('/convert')
  @UseInterceptors(FilesInterceptor('files'))
  async convert(
    @Body() body: IConvertDto,
    @UploadedFiles() uploadedFiles: Array<Express.Multer.File> = [],
  ) {
    const files = uploadedFiles.map((file) => file.buffer);
    const urls = Array.isArray(body.urls)
      ? body.urls
      : [body.urls].filter(Boolean);

    if (files.length + urls.length > 10) {
      throw new HttpException(
        'Maximum allowed number of sessions to convert is 10',
        400,
      );
    }

    for (let i = 0; i < urls.length; i++) {
      try {
        const url = urls[i];
        if (url.startsWith('https://disk.yandex.ru/')) {
          const file = await this.cloudsService.downloadFromYandex(url);
          files.push(file);
        } else if (url.startsWith('https://mega.nz/')) {
          const file = await this.cloudsService.downloadFromMega(url);
          files.push(file);
        } else if (url.startsWith('https://drive.google.com/')) {
          const file = await this.cloudsService.downloadFromDrive(url);
          files.push(file);
        }
      } catch (e) {
        console.error(e);
      }
    }

    const result: IFile[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const archive = files[i];
        const archiveFiles = await this.archivesService.uncompress(archive);
        const { keyFile, baseFile } =
          this.converterService.getFiles(archiveFiles);
        const session = await this.converterService.convert(keyFile, baseFile);
        const sqlite = this.sqliteService.buildSession(
          session.dcId,
          session.serverAddress,
          session.port,
          session.authKey.getKey(),
        );

        result.push({ name: `${i + 1}.session`, buffer: sqlite });
        result.push({
          name: `${i + 1}.json`,
          buffer: Buffer.from(
            JSON.stringify({
              session_file: i + 1,
              phone: undefined,
              register_time: undefined,
              app_id: 17349,
              app_hash: '344583e45741c457fe1862106095a5eb',
              sdk: 'Telegram Desktop',
              app_version: '4.7.1',
              device: 'Telegram Desktop',
              last_check_time: undefined,
              avatar: undefined,
              first_name: undefined,
              last_name: undefined,
              sex: undefined,
              lang_pack: 'en',
              system_lang_pack: 'en-us',
              success_registred: true,
              twoFA: undefined,
              ipv6: undefined,
              server_address6: undefined,
            }),
          ),
        });
      } catch (e) {
        console.error(e);
      }
    }
    const resultZip =
      result.length > 0
        ? (await this.archivesService.zip(result)).toString('base64')
        : null;
    return {
      count: Math.floor(result.length / 2),
      zip: resultZip,
    };
  }
}
