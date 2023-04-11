import { Injectable } from '@nestjs/common';
import * as unrar from 'node-unrar-js';
import * as crypto from 'crypto';
import { BinaryReader } from 'telegram/extensions';
import { IGE } from 'telegram/crypto/IGE';
import { AuthKey } from 'telegram/crypto/AuthKey';
import { StringSession } from 'telegram/sessions';
import fetch from 'node-fetch-commonjs';
import * as jszip from 'jszip';

@Injectable()
export class ConverterService {
  async downloadFromYandex(url: string) {
    const metadata = (await fetch(
      `https://cloud-api.yandex.net/v1/disk/public/resources/?public_key=${url}&path=/&offset=0`,
    ).then((res) => res.json())) as any;
    return await fetch(metadata.file)
      .then((res) => res.blob())
      .then((blob) => blob.arrayBuffer())
      .then((arrayBuffer) => Buffer.from(arrayBuffer));
  }

  async unrar(archive: Buffer) {
    const extractor = await unrar.createExtractorFromData({
      data: archive,
    });
    const { files } = extractor.extract();
    const filesArr = Array.from(files);
    const result = filesArr.map((file) => ({
      name: file.fileHeader.name,
      buffer: Buffer.from(file.extraction),
    }));
    return result;
  }

  async unzip(zip: Buffer) {
    const jszipInstance = new jszip();
    const result = await jszipInstance.loadAsync(zip);

    const files: Array<{ name: string; buffer: Buffer }> = [];
    const names = Object.keys(result.files);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const buffer = await result.files[name].async('nodebuffer');
      files.push({ name, buffer });
    }

    return files;
  }

  tdesktop_md5(data: string) {
    let result = '';
    const hash = crypto.createHash('md5').update(data).digest('hex');
    for (let i = 0; i < hash.length; i += 2) {
      result += hash[i + 1] + hash[i];
    }
    return result.toUpperCase();
  }

  tdesktop_readBuffer(file: BinaryReader) {
    const length = file.read(4).reverse().readInt32LE();
    return length > 0 ? file.read(length, false) : Buffer.alloc(0);
  }

  sha1(buf: Buffer) {
    return crypto.createHash('sha1').update(buf).digest();
  }

  /**
   * Old way of calculating aes keys
   */
  _calcKey(authKey: Buffer, msgKey: Buffer, client: boolean) {
    const x = client ? 0 : 8;
    const sha1_a = this.sha1(Buffer.concat([msgKey, authKey.slice(x, x + 32)]));
    const sha1_b = this.sha1(
      Buffer.concat([
        authKey.slice(32 + x, 32 + x + 16),
        msgKey,
        authKey.slice(48 + x, 48 + x + 16),
      ]),
    );
    const sha1_c = this.sha1(
      Buffer.concat([authKey.slice(64 + x, 64 + x + 32), msgKey]),
    );
    const sha1_d = this.sha1(
      Buffer.concat([msgKey, authKey.slice(96 + x, 96 + x + 32)]),
    );

    const aes_key = Buffer.concat([
      sha1_a.slice(0, 8),
      sha1_b.slice(8, 8 + 12),
      sha1_c.slice(4, 4 + 12),
    ]);
    const aes_iv = Buffer.concat([
      sha1_a.slice(8, 8 + 12),
      sha1_b.slice(0, 8),
      sha1_c.slice(16, 16 + 4),
      sha1_d.slice(0, 8),
    ]);

    return [aes_key, aes_iv];
  }

  tdesktop_decrypt(data: BinaryReader, auth_key: Buffer): BinaryReader {
    const message_key = data.read(16);
    const encrypted_data = data.read();
    const [aes_key, aes_iv] = this._calcKey(auth_key, message_key, false);
    const ige = new IGE(aes_key, aes_iv);
    const decrypted_data = ige.decryptIge(encrypted_data) as Buffer;

    if (
      message_key.toString('hex') !=
      this.sha1(decrypted_data).slice(0, 16).toString('hex')
    ) {
      throw new Error('msg_key mismatch');
    }
    return new BinaryReader(decrypted_data);
  }

  tdesktop_open_encrypted(file: Buffer, tdesktop_key: Buffer) {
    const f = this.tdesktop_open(file);
    const data = this.tdesktop_readBuffer(f);
    const res = this.tdesktop_decrypt(new BinaryReader(data), tdesktop_key);
    const length = res.readInt(false);
    if (length > res.getBuffer().length || length < 4) {
      throw new Error('Wrong length');
    }
    return res;
  }

  tdesktop_open(file: Buffer): BinaryReader {
    const fileToTry = new BinaryReader(file);
    const magic = fileToTry.read(4).toString('utf-8');
    if (magic != 'TDF$') {
      console.error('WRONG MAGIC');
      throw new Error('WRONG MAGIC');
    }
    const versionBytes = fileToTry.read(4);
    const version = versionBytes.readInt32LE(0);

    console.error(`TDesktop version: ${version}`);
    let data = fileToTry.read();
    const md5 = data.slice(-16).toString('hex');
    data = data.slice(0, -16);
    const length = Buffer.alloc(4);
    length.writeInt32LE(data.length, 0);
    const toCompare = Buffer.concat([
      data,
      length,
      versionBytes,
      Buffer.from('TDF$', 'utf-8'),
    ]);
    const hash = crypto.createHash('md5').update(toCompare).digest('hex');
    if (hash != md5) {
      throw new Error('Wrong MD5');
    }
    return new BinaryReader(data);
  }

  getServerAddress(dcId: number) {
    switch (dcId) {
      case 1:
        return '149.154.175.55';
      case 2:
        return '149.154.167.50';
      case 3:
        return '149.154.175.100';
      case 4:
        return '149.154.167.91';
      case 5:
        return '91.108.56.170';
      default:
        throw new Error('Invalid DC');
    }
  }

  async convert(keyFile: Buffer, baseFile: Buffer) {
    const data = this.tdesktop_open(keyFile);
    const salt = this.tdesktop_readBuffer(data);
    if (salt.length !== 32) {
      throw new Error('Length of salt is wrong!');
    }
    const encryptedKey = this.tdesktop_readBuffer(data);
    const encryptedInfo = this.tdesktop_readBuffer(data);
    const hash = crypto
      .createHash('sha512')
      .update(salt)
      .update('')
      .update(salt)
      .digest();
    const passKey = crypto.pbkdf2Sync(hash, salt, 1, 256, 'sha512');
    const key = this.tdesktop_readBuffer(
      this.tdesktop_decrypt(new BinaryReader(encryptedKey), passKey),
    );
    const info = this.tdesktop_readBuffer(
      this.tdesktop_decrypt(new BinaryReader(encryptedInfo), key),
    );
    const count = info.readUInt32BE();
    console.log('Accounts count', count);
    if (count !== 1) {
      throw new Error('Currently only supporting one account at a time');
    }
    const main = this.tdesktop_open_encrypted(baseFile, key);
    const magic = main.read(4).reverse().readUInt32LE();
    if (magic != 75) {
      throw new Error('Unsupported magic version');
    }
    const final = new BinaryReader(this.tdesktop_readBuffer(main));

    final.read(12);
    const userId = final.read(4).reverse().readUInt32LE();
    const mainDc = final.read(4).reverse().readUInt32LE();
    const length = final.read(4).reverse().readUInt32LE();
    const mainAuthKey = new AuthKey();
    for (let i = 0; i < length; i++) {
      const dc = final.read(4).reverse().readUInt32LE();
      const authKey = final.read(256);
      if (dc == mainDc) {
        await mainAuthKey.setKey(authKey);
        const session = new StringSession('');
        session.setDC(mainDc, this.getServerAddress(mainDc), 443);
        session.setAuthKey(mainAuthKey);

        return JSON.stringify({
          apiId: 2496,
          apiHash: '8da85b0d5bfe62527e5b244c209159c3',
          deviceModel: 'PC',
          systemVersion: 'Windows 10',
          appVersion: '2.7.1',
          serverAddress: session.serverAddress,
          dcId: session.dcId,
          port: session.port,
          authKey: session.authKey?.getKey()?.toString('hex'),
        });
      }
    }
    return;
  }

  getFiles(files: Array<{ name: string; buffer: Buffer }>) {
    const old_session_key = 'data';
    const part_one_md5 = this.tdesktop_md5(old_session_key).slice(0, 16);

    const result = {
      keyFile: null,
      baseFile: null,
    } as {
      keyFile: Buffer | null;
      baseFile: Buffer | null;
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!result.keyFile && file.name.includes('key_data')) {
        result.keyFile = file.buffer;
      } else if (!result.baseFile && file.name.includes(part_one_md5)) {
        result.baseFile = file.buffer;
      }
      if (result.keyFile && result.baseFile) {
        break;
      }
    }
    return result;
  }
}
