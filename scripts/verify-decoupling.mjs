import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_STRINGS = [
  '@lovable.dev',
  '__lovableEvents',
  'Lovable App',
  'Lovable Generated Project',
  'Connect Supabase in Lovable Cloud',
  'sfslfvaoopaagxmvjwjl',
  'bemhmggguanojzaahudc',
  '/codice/index.html'
];

const IGNORE_DIRS = ['.git', 'node_modules', 'dist'];

function checkFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const str of FORBIDDEN_STRINGS) {
      if (content.includes(str) && !filePath.includes('verify-decoupling.mjs') && !filePath.includes('implementation_plan.md') && !filePath.includes('task.md') && !filePath.includes('AGENTS.md') && !filePath.includes('CUTOVER_FROM_LOVABLE.md')) {
        console.error(`ERROR: Forbidden string "${str}" found in ${filePath}`);
        process.exit(1);
      }
    }
    
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      if (content.includes('service_role') && !filePath.includes('verify-decoupling.mjs')) {
        console.error(`ERROR: Possible service_role key usage in frontend code: ${filePath}`);
        process.exit(1);
      }
      const matches = content.match(/createClient\(/g);
      if (matches && matches.length > 1 && !filePath.includes('verify-decoupling.mjs')) {
        console.error(`ERROR: Multiple createClient initializations found in ${filePath}`);
        process.exit(1);
      }
    }
  } catch(e) {
    // Ignore non-text files
  }
}

function walk(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    if (IGNORE_DIRS.includes(file)) continue;
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else {
      checkFile(fullPath);
    }
  }
}

// 1. Check if .env is versioned
if (existsSync('.env')) {
  console.error("ERROR: .env is still present. It should be removed.");
  process.exit(1);
}

// 2. Check if index.html exists in root
if (!existsSync('index.html')) {
  console.error("ERROR: index.html not found in root directory.");
  process.exit(1);
}

walk('.');

console.log('Decoupling verification passed.');
