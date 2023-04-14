import { Injectable } from '@nestjs/common';
import * as unrar from 'node-unrar-js';
import jszip from 'jszip';
import { IFile } from 'src/app.interface';
const fileType = import('file-type');

@Injectable()
export class ArchivesService {
  async unrar(archive: Buffer) {
    const extractor = await unrar.createExtractorFromData({
      data: archive,
    });
    const { files } = extractor.extract();
    const filesArr = Array.from(files);
    const result = filesArr
      .filter((file) => file.extraction)
      .map((file) => ({
        name: file.fileHeader.name,
        buffer: Buffer.from(file.extraction),
      }));
    return result as IFile[];
  }

  async unzip(zip: Buffer) {
    const jszipInstance = new jszip();
    const result = await jszipInstance.loadAsync(zip);
    const files: IFile[] = [];
    const names = Object.keys(result.files);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const buffer = await result.files[name].async('nodebuffer');
      if (!result.files[name].dir) {
        files.push({ name, buffer });
      }
    }

    return files;
  }

  async uncompress(compressed: Buffer) {
    const { fileTypeFromBuffer } = await fileType;
    const { ext } = await fileTypeFromBuffer(compressed);
    if (ext === 'zip') {
      return await this.unzip(compressed);
    } else if (ext === 'rar') {
      return await this.unrar(compressed);
    }
  }

  async zip(files: IFile[]) {
    const jszipInstance = new jszip();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      jszipInstance.file(file.name, file.buffer);
    }
    return jszipInstance.generateAsync({ type: 'nodebuffer' });
  }
}
