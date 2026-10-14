#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/contract-pull.mjs <tag | path-to-zoo-vision-checkout>');
  process.exit(1);
}

const contractDir = path.resolve('src/contract');
fs.mkdirSync(contractDir, { recursive: true });

const openapiPath = path.join(contractDir, 'openapi.json');
const webDtsPath = path.join(contractDir, 'web.d.ts');
const feContractPath = path.join(contractDir, 'fe-contract.md');
const versionPath = path.join(contractDir, 'CONTRACT_VERSION');

if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
  const localOpenapi = path.join(target, 'apps/api/openapi.json');
  const localWebDts = path.join(target, 'packages/contracts/generated/web/index.d.ts');
  const localFeContract = path.join(target, 'docs/fe-contract.md');

  if (!fs.existsSync(localOpenapi)) {
    console.error(`Cannot find openapi.json at ${localOpenapi}`);
    process.exit(1);
  }

  fs.copyFileSync(localOpenapi, openapiPath);
  if (fs.existsSync(localWebDts)) {
    fs.copyFileSync(localWebDts, webDtsPath);
  }
  if (fs.existsSync(localFeContract)) {
    fs.copyFileSync(localFeContract, feContractPath);
  }

  let commit = 'unknown';
  try {
    commit = execSync(`git -C "${target}" rev-parse --short HEAD`, { encoding: 'utf-8' }).trim();
  } catch {
    commit = 'unknown';
  }

  const version = `local:${target}@${commit}`;
  fs.writeFileSync(versionPath, version + '\n', 'utf-8');
  console.log(`Pulled contract from local path: ${version}`);
} else {
  const tag = target;
  const baseUrl = `https://raw.githubusercontent.com/Aryaputra34/zoo-vision/${tag}`;

  async function download(relPath, dest) {
    const url = `${baseUrl}/${relPath}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    fs.writeFileSync(dest, text, 'utf-8');
  }

  try {
    await download('apps/api/openapi.json', openapiPath);
    await download('packages/contracts/generated/web/index.d.ts', webDtsPath);
    await download('docs/fe-contract.md', feContractPath);
    fs.writeFileSync(versionPath, tag + '\n', 'utf-8');
    console.log(`Pulled contract tag: ${tag}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

console.log('Running orval...');
try {
  execSync('npx orval', { stdio: 'inherit' });
} catch (err) {
  console.error('Orval generation failed:', err.message);
  process.exit(1);
}
