import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch-commonjs';
import * as Mega from 'megajs';

@Injectable()
export class CloudsService {
  async downloadFromYandex(url: string) {
    const metadata = (await fetch(
      `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${url}&path=/&offset=0`,
    ).then((res) => res.json())) as any;
    return fetch(metadata.href)
      .then((res) => res.blob())
      .then((blob) => blob.arrayBuffer())
      .then((arrayBuffer) => Buffer.from(arrayBuffer));
  }

  async downloadFromMega(url: string) {
    return Mega.File.fromURL(url).downloadBuffer({});
  }

  async downloadFromDrive(url: string) {
    const id = url.replace(/.*file\/d\/(.*)\/.*/, '$1');
    return fetch(`https://drive.google.com/uc?id=${id}`)
      .then((res) => res.blob())
      .then((blob) => blob.arrayBuffer())
      .then((arrayBuffer) => Buffer.from(arrayBuffer));
  }
}
