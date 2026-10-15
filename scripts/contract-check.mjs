#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const contractDir = path.resolve('src/contract');
const versionPath = path.join(contractDir, 'CONTRACT_VERSION');
const openapiPath = path.join(contractDir, 'openapi.json');

if (!fs.existsSync(versionPath)) {
  console.error('Contract check failed: CONTRACT_VERSION file does not exist');
  process.exit(1);
}

const version = fs.readFileSync(versionPath, 'utf-8').trim();
if (version.startsWith('local:')) {
  console.error(`Contract check failed: CONTRACT_VERSION is set to local checkout: ${version}`);
  process.exit(1);
}

if (!fs.existsSync(openapiPath)) {
  console.error('Contract check failed: openapi.json does not exist');
  process.exit(1);
}

console.log(`Checking contract version: ${version}`);
console.log('Verifying generated API client against committed openapi.json...');

try {
  execSync('npx orval', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run orval:', err.message);
  process.exit(1);
}

try {
  const modified = execSync('git diff --name-only src/api/generated', { encoding: 'utf-8' }).trim();
  const untracked = execSync('git ls-files --others --exclude-standard src/api/generated', { encoding: 'utf-8' }).trim();

  if (modified || untracked) {
    console.error('Contract check failed: re-running orval produced changes in src/api/generated/:');
    if (modified) console.error(`Modified:\n${modified}`);
    if (untracked) console.error(`Untracked:\n${untracked}`);
    process.exit(1);
  }
} catch (err) {
  console.error('Git status check failed:', err.message);
  process.exit(1);
}

console.log('Contract check passed.');
