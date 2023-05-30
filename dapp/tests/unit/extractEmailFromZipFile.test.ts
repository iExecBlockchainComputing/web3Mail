import { describe, it, expect } from '@jest/globals';
import { extractEmailFromZipFile } from '../../src/extractEmailFromZipFile';
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe('extractEmailFromZipFile', () => {
  it('returns a valid email address for a valid .zip file', async () => {
    const zipPath = path.join(__dirname, '../_test_inputs_/data.zip');
    const result = await extractEmailFromZipFile(zipPath);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(result).toMatch(emailPattern);
  });

  it('throws an error for a non-existent file', async () => {
    const zipPath = path.join(__dirname, './non-existent-file.zip');
    await expect(extractEmailFromZipFile(zipPath)).rejects.toThrow(
      `ENOENT: no such file or directory, open '${zipPath}'`
    );
  });

  it('throws an error if no email file is found in the zip', async () => {
    const zip = new JSZip();
    zip.file('file1.txt', 'content1');
    zip.file('file2.txt', 'content2');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(__dirname, 'no-email.zip');
    await fs.writeFile(zipPath, zipBuffer);
    await expect(extractEmailFromZipFile(zipPath)).rejects.toThrow(
      'No email file was found in the zip.'
    );
    await fs.unlink(zipPath);
  });
});
