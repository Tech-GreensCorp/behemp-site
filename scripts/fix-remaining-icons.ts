/**
 * Script de correção final: substitui referências Hugeicons restantes por Lucide React.
 * Processa: nomes de ícones no JSX e em referências de tipo, imports HugeiconsIcon, etc.
 */
import * as fs from 'fs';
import * as path from 'path';

// Mapeamento de ícones Hugeicons → Lucide
const REPLACEMENTS: Record<string, string> = {
  // Nomes usados como referência (sem <>)
  'UserIcon': 'User',
  'UserMultiple02Icon': 'Users',
  'Stethoscope02Icon': 'Stethoscope',
  'Calendar03Icon': 'CalendarDays',
  'Calendar01Icon': 'Calendar',
  'CheckmarkCircle01Icon': 'CheckCircle2',
  'Notification03Icon': 'Bell',
  'FileValidationIcon': 'FileCheck',
  'MedicineBottle01Icon': 'Pill',
  'Message01Icon': 'MessageSquare',
  'SecurityCheckIcon': 'Shield',
  'ShieldUserIcon': 'ShieldCheck',
  'Shield01Icon': 'Shield',
  'Loading03Icon': 'Loader2',
  'Cancel01Icon': 'X',
  'Edit02Icon': 'Pencil',
  'UserAdd01Icon': 'UserPlus',
  'HeartCheckIcon': 'HeartPulse',
  'Video01Icon': 'Video',
  'Clock01Icon': 'Clock',
  'UserCheck01Icon': 'UserCheck',
  'LinkSquare01Icon': 'ExternalLink',
  'Home01Icon': 'Home',
  'Award01Icon': 'Award',
  'File01Icon': 'FileText',
  'Location01Icon': 'MapPin',
  'LocationUpdate01Icon': 'MapPinned',
  'Mail01Icon': 'Mail',
  'Menu01Icon': 'Menu',
  'Search01Icon': 'Search',
  'SmartPhone01Icon': 'Smartphone',
  'Money01Icon': 'DollarSign',
  'Certificate01Icon': 'BadgeCheck',
  'DeliveryBox01Icon': 'Package',
  'DeliveryTruck01Icon': 'Truck',
  'Loader2Icon': 'Loader2',
  'HeartbreakIcon': 'HeartCrack',
  'BabyBottleIcon': 'Baby',
  'BrainIcon': 'Brain',
  'DumbbellIcon': 'Dumbbell',
  'SmileIcon': 'Smile',
  'UserGroupIcon': 'Users',
  'SparklesIcon': 'Sparkles',

  // Nomes usados em JSX (sem Icon suffix)
  'Stethoscope02': 'Stethoscope',
  'CheckmarkCircle01': 'CheckCircle2',
  'Calendar03': 'CalendarDays',
  'Video01': 'Video',
  'Notification03': 'Bell',
  'MedicineBottle01': 'Pill',
  'SecurityCheck': 'Shield',
  'LinkSquare01': 'ExternalLink',
  'UserAdd01': 'UserPlus',
  'Loading03': 'Loader2',
  'Cancel01': 'X',
  'Edit02': 'Pencil',
  'View': 'Eye',
  'Heartbreak': 'HeartCrack',
  'HeartCheck': 'HeartPulse',
  'Download01': 'Download',
  'Upload01': 'Upload',
  'Recycle02': 'RotateCcw',
  'Home01': 'Home',
  'Award01': 'Award',
  'File01': 'FileText',
  'Location01': 'MapPin',
  'Mail01': 'Mail',
  'SmartPhone01': 'Smartphone',
  'Certificate01': 'BadgeCheck',
  'DeliveryBox01': 'Package',
  'DeliveryTruck01': 'Truck',
  'Shield01': 'Shield',
  'Money01': 'DollarSign',
  'Search01': 'Search',
  'Menu01': 'Menu',
};

function findFiles(dir: string): string[] {
  const result: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      result.push(...findFiles(fullPath));
    } else if (item.isFile() && /\.tsx?$/.test(item.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

const rootDir = path.resolve(__dirname, '..');
const files = findFiles(path.join(rootDir, 'app'))
  .concat(findFiles(path.join(rootDir, 'components')));

let totalFixed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let modified = false;
  const usedLucideIcons = new Set<string>();

  // 1. Remover imports de @hugeicons (se algum restou)
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"]@hugeicons\/[^'"]+['"];\n?/g, () => {
    modified = true;
    return '';
  });
  // Remover import do HugeiconsIcon
  content = content.replace(/import\s+\{?\s*HugeiconsIcon\s*\}?\s+from\s+['"]@hugeicons\/[^'"]+['"];\n?/g, () => {
    modified = true;
    return '';
  });

  // 2a. Substituir <HugeiconsIcon icon={XXX} size={N} ... /> (single-line)
  content = content.replace(/<HugeiconsIcon\s+icon=\{(\w+)\}\s+size=\{(\d+)\}([^/]*)\s*\/>/g, (_, iconName, size, rest) => {
    modified = true;
    const lucideName = REPLACEMENTS[iconName] || 'HelpCircle';
    usedLucideIcons.add(lucideName);
    return `<${lucideName} size={${size}}${rest} />`;
  });

  // 2b. Substituir <HugeiconsIcon icon={XXX} size={N} ... /> (multi-line)
  content = content.replace(/<HugeiconsIcon\s*\n\s*icon=\{(\w+)\}\s*\n\s*size=\{(\d+)\}([^/]*)\s*\/>/g, (_, iconName, size, rest) => {
    modified = true;
    const lucideName = REPLACEMENTS[iconName] || 'HelpCircle';
    usedLucideIcons.add(lucideName);
    return `<${lucideName} size={${size}}${rest.trim() ? ' ' + rest.trim() : ''} />`;
  });

  // 2c. Substituir <HugeiconsIcon icon={var.prop} size={N} /> (dinâmico)
  content = content.replace(/<HugeiconsIcon\s+icon=\{(\w+(?:\.\w+)?(?:\?\.\w+)?(?:\s*\?\?\s*\w+)?)\}\s+size=\{(\d+)\}\s*\/>/g, (_, iconExpr, size) => {
    modified = true;
    // Substituir ícone fallback se presente
    let expr = iconExpr;
    for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
      expr = expr.replace(new RegExp(`\\b${hugeName}\\b`, 'g'), lucideName);
      if (expr !== iconExpr) usedLucideIcons.add(lucideName);
    }
    return `{(() => { const DynIcon = ${expr}; return <DynIcon size={${size}} />; })()}`;
  });

  // 2d. Substituir <HugeiconsIcon icon={ternary ? A : B} size={N} /> 
  content = content.replace(/<HugeiconsIcon\s+icon=\{([^}]+)\}\s+size=\{(\d+)\}\s*\/>/g, (_, iconExpr, size) => {
    modified = true;
    let expr = iconExpr;
    for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
      const before = expr;
      expr = expr.replace(new RegExp(`\\b${hugeName}\\b`, 'g'), lucideName);
      if (expr !== before) usedLucideIcons.add(lucideName);
    }
    return `{(() => { const DynIcon = ${expr}; return <DynIcon size={${size}} />; })()}`;
  });

  // 2e. Substituir <HugeiconsIcon\n multi-line com icon={var.prop}
  content = content.replace(/<HugeiconsIcon\s*\n\s*icon=\{([^}]+)\}\s*\n\s*size=\{(\d+)\}[^/]*\/>/g, (_, iconExpr, size) => {
    modified = true;
    let expr = iconExpr.trim();
    for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
      const before = expr;
      expr = expr.replace(new RegExp(`\\b${hugeName}\\b`, 'g'), lucideName);
      if (expr !== before) usedLucideIcons.add(lucideName);
    }
    return `{(() => { const DynIcon = ${expr}; return <DynIcon size={${size}} />; })()}`;
  });

  // 3. Substituir referências de tipo: typeof XXXIcon → typeof LucideEquiv
  for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
    const typeofRegex = new RegExp(`typeof ${hugeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    if (typeofRegex.test(content)) {
      content = content.replace(typeofRegex, `typeof ${lucideName}`);
      usedLucideIcons.add(lucideName);
      modified = true;
    }
  }

  // 4. Substituir nomes de ícones usados como valores (ex: icon: UserIcon → icon: User)
  for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
    // Match: icon: XXXIcon  ou  icon: XXX (sem Icon)
    const propRegex = new RegExp(`(icon:\\s*)${hugeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    if (propRegex.test(content)) {
      content = content.replace(propRegex, `$1${lucideName}`);
      usedLucideIcons.add(lucideName);
      modified = true;
    }
  }

  // 5. Substituir JSX tags: <Stethoscope02 → <Stethoscope, etc.
  for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
    // Só nomes sem "Icon" suffix para tags JSX
    if (hugeName.endsWith('Icon')) continue;
    
    const tagRegex = new RegExp(`<${hugeName}(\\s)`, 'g');
    if (tagRegex.test(content)) {
      content = content.replace(tagRegex, `<${lucideName}$1`);
      usedLucideIcons.add(lucideName);
      modified = true;
    }
  }

  // 6. Substituir || Notification03Icon → || Bell, etc.
  for (const [hugeName, lucideName] of Object.entries(REPLACEMENTS)) {
    const fallbackRegex = new RegExp(`\\|\\|\\s*${hugeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    if (fallbackRegex.test(content)) {
      content = content.replace(fallbackRegex, `|| ${lucideName}`);
      usedLucideIcons.add(lucideName);
      modified = true;
    }
  }

  // 7. Garantir que os ícones Lucide usados estão importados
  if (modified && usedLucideIcons.size > 0) {
    // Encontrar import existente de lucide-react
    const lucideImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/;
    const match = content.match(lucideImportRegex);
    
    if (match) {
      const existingIcons = match[1].split(',').map(s => s.trim()).filter(Boolean);
      const allIcons = new Set([...existingIcons, ...usedLucideIcons]);
      const sortedIcons = [...allIcons].sort().filter(i => i.length > 0);
      const newImport = `import {\n  ${sortedIcons.join(',\n  ')},\n} from 'lucide-react'`;
      content = content.replace(lucideImportRegex, newImport);
    } else {
      // Adicionar import no topo (após 'use client' se existir)
      const sortedIcons = [...usedLucideIcons].sort();
      const importStr = `import {\n  ${sortedIcons.join(',\n  ')},\n} from 'lucide-react';\n`;
      if (content.startsWith("'use client'")) {
        content = content.replace("'use client';", `'use client';\n\n${importStr}`);
      } else {
        content = importStr + content;
      }
    }

    fs.writeFileSync(file, content, 'utf-8');
    totalFixed++;
    console.log(`Fixed: ${path.relative(rootDir, file)} (+${usedLucideIcons.size} icons)`);
  } else if (modified) {
    fs.writeFileSync(file, content, 'utf-8');
    totalFixed++;
    console.log(`Cleaned: ${path.relative(rootDir, file)}`);
  }
}

console.log(`\nDone! Fixed ${totalFixed} files.`);
