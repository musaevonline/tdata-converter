import * as Database from 'better-sqlite3';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';

const template = readFileSync('template.session');

@Injectable()
export class SqliteService {
  buildSession(
    dcId: number,
    serverAddress: string,
    port: number,
    authKey: Buffer,
  ) {
    const db = new Database(template);
    const insertStmt = db.prepare(
      'INSERT INTO sessions (dc_id, server_address, port, auth_key) VALUES (@dcId, @serverAddress, @port, @authKey)',
    );
    insertStmt.run({
      dcId,
      serverAddress,
      port,
      authKey,
    });
    const result = db.serialize();
    db.close();
    return result;
  }
}
