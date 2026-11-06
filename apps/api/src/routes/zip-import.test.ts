import { describe, it, expect, beforeAll, afterAll } from "vitest";
import zlib from "node:zlib";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import type { FastifyInstance } from "fastify";

// Low-level pure test helper to generate deterministic ZIP binary buffers
interface ZipFileEntrySpec {
  name: string;
  content: string | Buffer;
  isSymlink?: boolean;
  deflate?: boolean;
  overrideUncompressedSize?: number; // for bomb simulation
}

function createZipBuffer(entries: ZipFileEntrySpec[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const rawContent = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");

    const compressed = entry.deflate
      ? zlib.deflateRawSync(rawContent)
      : rawContent;

    const compressionMethod = entry.deflate ? 8 : 0;
    const fileNameBuf = Buffer.from(entry.name, "utf8");
    const uncompressedSize = entry.overrideUncompressedSize ?? rawContent.length;
    const compressedSize = compressed.length;

    // 1. Local Header
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // sig
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(compressionMethod, 8); // method
    localHeader.writeUInt16LE(0, 10); // time
    localHeader.writeUInt16LE(0, 12); // date
    localHeader.writeUInt32LE(0, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(fileNameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len
    fileNameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // 2. Central Directory Header
    const centralHeader = Buffer.alloc(46 + fileNameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // sig
    centralHeader.writeUInt16LE(entry.isSymlink ? 0x031e : 0x0014, 4); // version made by (Unix 0x03)
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(fileNameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attr
    // Unix mode: if symlink, S_IFLNK (0o120777 << 16)
    const externalAttr = entry.isSymlink ? ((0o120777 << 16) >>> 0) : ((0o100644 << 16) >>> 0);
    centralHeader.writeUInt32LE(externalAttr, 38);
    centralHeader.writeUInt32LE(currentOffset, 42); // local header offset
    fileNameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    currentOffset += localHeader.length + compressed.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // 3. End of Central Directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

describe("LOOP 9 — Repository ZIP Archive Ingestion & Security Hardening", () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    config.DEFAULT_AI_PROVIDER = "mock";
    app = await buildApp(config);
    await app.ready();

    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Zip Import Corp",
        ownerEmail: "owner@zipimport.corp",
        ownerName: "Zip Owner",
      },
    });
    const testOrg = orgRes.json().organization;

    // 2. Add Admin member
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Admin Eve", email: "eve@zipimport.corp", role: "admin" },
    });

    // 3. Mint Admin token
    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "eve@zipimport.corp" },
    });
    adminToken = tokenRes.json().token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("successfully parses valid multi-file ZIP archive and tags read-only files", async () => {
    const zip = createZipBuffer([
      { name: "package.json", content: '{"name": "test-repo"}' },
      { name: "src/index.ts", content: "export function add(a: number, b: number) { return a + b; }" },
      { name: "src/index.test.ts", content: "test('add', () => expect(add(1, 2)).toBe(3));" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: zip.toString("base64") },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.totalFiles).toBe(3);

    const testFile = body.files.find((f: any) => f.path === "src/index.test.ts");
    expect(testFile).toBeDefined();
    expect(testFile.isReadOnly).toBe(true);

    const srcFile = body.files.find((f: any) => f.path === "src/index.ts");
    expect(srcFile).toBeDefined();
    expect(srcFile.isReadOnly).toBe(false);
  });

  it("rejects Zip Slip directory traversal attack with ../ paths", async () => {
    const maliciousZip = createZipBuffer([
      { name: "../../etc/shadow", content: "root::0:0:root:/root:/bin/bash" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: maliciousZip.toString("base64") },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ZIP_TRAVERSAL_ATTACK_REJECTED");
  });

  it("rejects archive with absolute Unix root path", async () => {
    const maliciousZip = createZipBuffer([
      { name: "/etc/passwd", content: "evil content" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: maliciousZip.toString("base64") },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ZIP_ABSOLUTE_PATH_REJECTED");
  });

  it("rejects archive containing Windows drive letters", async () => {
    const maliciousZip = createZipBuffer([
      { name: "C:\\Windows\\System32\\calc.exe", content: "binary" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: maliciousZip.toString("base64") },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ZIP_WINDOWS_DRIVE_REJECTED");
  });

  it("rejects archive with Unix symbolic link entries", async () => {
    const symlinkZip = createZipBuffer([
      { name: "src/link.ts", content: "/etc/passwd", isSymlink: true },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: symlinkZip.toString("base64") },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ZIP_SECURITY_SYMLINK_REJECTED");
  });

  it("rejects executable and binary files (.exe, .sh, .dll)", async () => {
    const binaryZip = createZipBuffer([
      { name: "bin/backdoor.sh", content: "#!/bin/bash\nrm -rf /" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: binaryZip.toString("base64") },
    });

    expect(res.statusCode).toBe(415);
    expect(res.json().error).toBe("ZIP_UNSUPPORTED_EXTENSION");
  });

  it("rejects compression ratio explosion / zip bomb attacks (> 50:1)", async () => {
    // 100 bytes compressed claiming to decompress to 100,000 bytes (1000:1 ratio)
    const bombZip = createZipBuffer([
      {
        name: "bomb.txt",
        content: "A".repeat(100),
        deflate: true,
        overrideUncompressedSize: 500000,
      },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: bombZip.toString("base64") },
    });

    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe("ZIP_BOMB_DETECTED");
  });

  it("filters sensitive repository files (.env, .git, node_modules) without crashing", async () => {
    const repoWithSecrets = createZipBuffer([
      { name: ".env", content: "SECRET_KEY=12345" },
      { name: ".git/config", content: "[core] bare = false" },
      { name: "node_modules/foo/index.js", content: "console.log('vendor')" },
      { name: "src/app.ts", content: "console.log('legit app');" },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/templates/repository/upload-zip",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { zipBase64: repoWithSecrets.toString("base64") },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalFiles).toBe(1);
    expect(body.files[0].path).toBe("src/app.ts");
    expect(body.skippedFiles.length).toBe(3);
  });
});
