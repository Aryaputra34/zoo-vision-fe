import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

test('a path pull writes CONTRACT_VERSION local:<path>@<commit>, and contract:check then fails', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoo-vision-dummy-'));
  const versionFile = path.resolve('src/contract/CONTRACT_VERSION');
  // The pull writes into the real src/contract: keep every file to put it back afterwards.
  const contractDir = path.resolve('src/contract');
  const saved = new Map(
    fs.readdirSync(contractDir).map((f) => [f, fs.readFileSync(path.join(contractDir, f))]),
  );

  try {
    fs.mkdirSync(path.join(tmpDir, 'apps/api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'packages/contracts/generated/web'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });

    // Copy current openapi.json so orval can succeed
    const existingOpenapi = path.resolve('src/contract/openapi.json');
    if (fs.existsSync(existingOpenapi)) {
      fs.copyFileSync(existingOpenapi, path.join(tmpDir, 'apps/api/openapi.json'));
    } else {
      fs.writeFileSync(path.join(tmpDir, 'apps/api/openapi.json'), '{}');
    }
    fs.writeFileSync(path.join(tmpDir, 'packages/contracts/generated/web/index.d.ts'), 'export {};');
    fs.writeFileSync(path.join(tmpDir, 'docs/fe-contract.md'), '# Contract');

    execSync('git init && git config user.name "Test" && git config user.email "test@example.com" && git add . && git commit -m "init"', {
      cwd: tmpDir,
      stdio: 'ignore',
    });

    const commit = execSync('git rev-parse --short HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    execSync(`node scripts/contract-pull.mjs "${tmpDir}"`, { stdio: 'ignore' });

    const updatedVersion = fs.readFileSync(versionFile, 'utf-8').trim();
    assert.ok(
      updatedVersion.startsWith(`local:${tmpDir}@${commit}`),
      `Expected ${updatedVersion} to start with local:${tmpDir}@${commit}`
    );

    // contract:check should fail
    let checkFailed = false;
    try {
      execSync('node scripts/contract-check.mjs', { stdio: 'pipe' });
    } catch {
      checkFailed = true;
    }
    assert.strictEqual(checkFailed, true, 'contract:check should have failed on local: version');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [f, content] of saved) fs.writeFileSync(path.join(contractDir, f), content);
  }
});
