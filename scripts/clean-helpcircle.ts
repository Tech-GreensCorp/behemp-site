/**
 * Remove imports não usados de HelpCircle.
 */
import * as fs from 'fs';
import * as path from 'path';

function findFiles(dir: string): string[] {
  const result: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      result.push(...findFiles(fullPath));
    } else if (item.isFile() && /\.tsx?$/.test(item.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('HelpCircle') && !content.includes('<HelpCircle')) {
        result.push(fullPath);
      }
    }
  }
  return result;
}

const rootDir = path.resolve(__dirname, '..');
const files = findFiles(rootDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  // Remove HelpCircle from import list
  content = content.replace(/  HelpCircle,\n/g, '');
  content = content.replace(/,\n  HelpCircle\n/g, '\n');
  fs.writeFileSync(file, content, 'utf-8');
  console.log(`Cleaned: ${path.relative(rootDir, file)}`);
}

console.log(`\nDone! Cleaned ${files.length} files.`);
