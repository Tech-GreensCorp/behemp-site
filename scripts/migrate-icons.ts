/**
 * Script para migrar automaticamente referências de @hugeicons para lucide-react.
 * 
 * Uso: npx tsx scripts/migrate-icons.ts
 * 
 * Mapeamento de ícones Hugeicons → Lucide React
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ── Mapeamento de ícones ──────────────────────────────────────

const ICON_MAP: Record<string, string> = {
  // Dashboard & Layout
  'DashboardSquare01Icon': 'LayoutDashboard',
  'DashboardSquare02Icon': 'LayoutDashboard',
  
  // Navigation
  'Route01Icon': 'Route',
  'ArrowLeft01Icon': 'ChevronLeft',
  'ArrowRight01Icon': 'ChevronRight',
  'Menu02Icon': 'Menu',
  
  // Users
  'UserMultiple02Icon': 'Users',
  'UserIcon': 'User',
  'UserAdd01Icon': 'UserPlus',
  'UserSearch01Icon': 'UserSearch',
  
  // Files & Documents
  'FileValidationIcon': 'FileCheck',
  'File01Icon': 'FileText',
  'FileUpload01Icon': 'Upload',
  'FileDownload01Icon': 'Download',
  'FileEditIcon': 'FileEdit',
  'Document01Icon': 'FileText',
  
  // Communication
  'Notification03Icon': 'Bell',
  'Message01Icon': 'MessageSquare',
  'Mail01Icon': 'Mail',
  
  // Settings & Auth
  'Settings01Icon': 'Settings',
  'Settings02Icon': 'Settings',
  'Login01Icon': 'LogIn',
  'Logout01Icon': 'LogOut',
  'Shield01Icon': 'Shield',
  'ShieldKeyhole01Icon': 'ShieldCheck',
  
  // Calendar & Time
  'Calendar03Icon': 'Calendar',
  'Calendar01Icon': 'Calendar',
  'Clock01Icon': 'Clock',
  'TimeScheduleIcon': 'Clock',
  
  // Medical
  'MedicineBottle01Icon': 'Pill',
  'MedicineIcon': 'Pill',
  'Hospital01Icon': 'Hospital',
  'Stethoscope01Icon': 'Stethoscope',
  
  // Shopping & Commerce
  'ShoppingCart01Icon': 'ShoppingCart',
  
  // Misc UI
  'SmartPhone01Icon': 'Smartphone',
  'Location01Icon': 'MapPin',
  'Search01Icon': 'Search',
  'Add01Icon': 'Plus',
  'Cancel01Icon': 'X',
  'CheckmarkCircle02Icon': 'CheckCircle',
  'CheckmarkSquare02Icon': 'CheckSquare',
  'InformationCircleIcon': 'Info',
  'WarningIcon': 'AlertTriangle',
  'AlertCircleIcon': 'AlertCircle',
  'EyeIcon': 'Eye',
  'ViewOffSlashIcon': 'EyeOff',
  'Copy01Icon': 'Copy',
  'Edit01Icon': 'Pencil',
  'Edit02Icon': 'Pencil',
  'Delete01Icon': 'Trash2',
  'Delete02Icon': 'Trash2',
  'Loading01Icon': 'Loader2',
  'Loading03Icon': 'Loader2',
  'ArrowDown01Icon': 'ChevronDown',
  'ArrowUp01Icon': 'ChevronUp',
  'FilterIcon': 'Filter',
  'SortingIcon': 'ArrowUpDown',
  'MoreVerticalIcon': 'MoreVertical',
  'MoreHorizontalIcon': 'MoreHorizontal',
  'StarIcon': 'Star',
  'HeartIcon': 'Heart',
  'Share01Icon': 'Share2',
  'LinkIcon': 'Link',
  'ExternalLinkIcon': 'ExternalLink',
  'PrinterIcon': 'Printer',
  'SaveIcon': 'Save',
  'RefreshIcon': 'RefreshCw',
  'Csv01Icon': 'Sheet',
  'ChartLineData01Icon': 'LineChart',
  'ChartBarIcon': 'BarChart3',
  'AnalyticsUpIcon': 'TrendingUp',
  'AnalyticsDownIcon': 'TrendingDown',
  'ImageUploadIcon': 'ImagePlus',
  'Image01Icon': 'Image',
  'PaintBoardIcon': 'Palette',
  'TextIcon': 'Type',
  'BoldIcon': 'Bold',
  'GridViewIcon': 'Grid3X3',
  'ListViewIcon': 'List',
  'DocumentAttachmentIcon': 'Paperclip',
  'SentIcon': 'Send',
  'CallIcon': 'Phone',
  'WhatsappIcon': 'MessageCircle',
  'HomeIcon': 'Home',
  'Home01Icon': 'Home',
  'GoogleIcon': 'Chrome',
  'ChartHistogramIcon': 'BarChart',
  'ChartIcon': 'BarChart3',
  'ActivityIcon': 'Activity',
  'Activity01Icon': 'Activity',
  'DropletIcon': 'Droplets',
  'TestTubeIcon': 'TestTube2',
  'TestTube01Icon': 'TestTube2',
  'FlaskConicalIcon': 'FlaskConical',
  'ThermometerIcon': 'Thermometer',
  'ScaleIcon': 'Scale',
  'TicketIcon': 'Ticket',
  'PdfIcon': 'FileDown',
  'Pdf01Icon': 'FileDown',
  'BarChart01Icon': 'BarChart3',
  'PieChart01Icon': 'PieChart',
  'ArrowTrendingUpIcon': 'TrendingUp',
  'UserGroupIcon': 'Users',
  'HealthIcon': 'HeartPulse',
  'BookOpenIcon': 'BookOpen',
  'BookOpen01Icon': 'BookOpen',
  'ClipboardIcon': 'ClipboardList',
  'Clipboard01Icon': 'ClipboardList',
  'FileTextIcon': 'FileText',
  'MapPinIcon': 'MapPin',
  'GlobalIcon': 'Globe',
  'Globe01Icon': 'Globe',
  'BriefcaseIcon': 'Briefcase',
  'Briefcase01Icon': 'Briefcase',
  'HandshakeIcon': 'Handshake',
  'Handshake01Icon': 'Handshake',
  'AwardIcon': 'Award',
  'Award01Icon': 'Award',
  'SparklesIcon': 'Sparkles',
  'ZapIcon': 'Zap',
  'Zap01Icon': 'Zap',
  
  // Ícones faltantes (segunda passada)
  'Alert02Icon': 'AlertCircle',
  'CheckmarkCircle01Icon': 'CheckCircle2',
  'Stethoscope02Icon': 'Stethoscope',
  'StethoscopeIcon': 'Stethoscope',
  'NoteIcon': 'StickyNote',
  'Upload01Icon': 'Upload',
  'MicroscopeIcon': 'Microscope',
  'FileExportIcon': 'FileOutput',
  'MinusSignIcon': 'Minus',
  'Download01Icon': 'Download',
  'ViewIcon': 'Eye',
  'TaskDaily01Icon': 'ListChecks',
  'Money01Icon': 'DollarSign',
  'HeartbreakIcon': 'HeartCrack',
  'Camera01Icon': 'Camera',
  'BrainIcon': 'Brain',
  'HeartCheckIcon': 'HeartPulse',
  'Leaf01Icon': 'Leaf',
  'DeliveryBox01Icon': 'Package',
  'Certificate01Icon': 'BadgeCheck',
  'Doctor01Icon': 'Stethoscope',
  'BabyBottleIcon': 'Baby',
  'DumbbellIcon': 'Dumbbell',
  'SmileIcon': 'Smile',
  'LinkSquare01Icon': 'ExternalLink',
  'DeliveryTruck01Icon': 'Truck',
  'HelpCircleIcon': 'HelpCircle',
  'LayoutGridIcon': 'LayoutGrid',
  'Menu01Icon': 'Menu',
  'Video01Icon': 'Video',
  'UserCheck01Icon': 'UserCheck',
  'UploadSquare02Icon': 'Upload',
};

// ── Buscar arquivos ──────────────────────────────────────────

function findFiles(dir: string, pattern: RegExp): string[] {
  const result: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      result.push(...findFiles(fullPath, pattern));
    } else if (item.isFile() && pattern.test(item.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('@hugeicons')) {
        result.push(fullPath);
      }
    }
  }
  
  return result;
}

// ── Processar um arquivo ─────────────────────────────────────

function processFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // 1. Extrair todos os ícones importados de @hugeicons/core-free-icons
  const hugeImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@hugeicons\/core-free-icons['"];?/g;
  const iconTypeRegex = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@hugeicons\/react['"];?/g;
  const hugeComponentRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@hugeicons\/react['"];?/g;
  
  const importedIcons: string[] = [];
  let match;
  
  while ((match = hugeImportRegex.exec(content)) !== null) {
    const icons = match[1].split(',').map((s: string) => s.trim()).filter(Boolean);
    importedIcons.push(...icons);
  }
  
  // 2. Mapear para Lucide
  const lucideIcons = new Set<string>();
  for (const icon of importedIcons) {
    const lucide = ICON_MAP[icon];
    if (lucide) {
      lucideIcons.add(lucide);
    } else {
      console.warn(`  ⚠ Ícone não mapeado: ${icon} em ${filePath}`);
      lucideIcons.add('HelpCircle'); // Fallback
    }
  }
  
  // 3. Remover imports de @hugeicons
  content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]@hugeicons\/core-free-icons['"];?\s*\n?/g, '');
  content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]@hugeicons\/react['"];?\s*\n?/g, '');
  content = content.replace(/import\s+type\s*\{[^}]+\}\s*from\s*['"]@hugeicons\/react['"];?\s*\n?/g, '');
  
  // 4. Adicionar import de lucide-react (se não existe já)
  if (lucideIcons.size > 0 && !content.includes("from 'lucide-react'")) {
    const sortedIcons = Array.from(lucideIcons).sort();
    const lucideImport = `import {\n  ${sortedIcons.join(',\n  ')},\n} from 'lucide-react';`;
    
    // Inserir após último import existente
    const lastImportIdx = content.lastIndexOf('\nimport ');
    if (lastImportIdx !== -1) {
      const endOfImport = content.indexOf('\n', content.indexOf(';', lastImportIdx));
      content = content.slice(0, endOfImport + 1) + lucideImport + '\n' + content.slice(endOfImport + 1);
    }
  } else if (lucideIcons.size > 0 && content.includes("from 'lucide-react'")) {
    // Já tem import de lucide-react, adicionar os novos ícones
    const existingMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
    if (existingMatch) {
      const existing = existingMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean);
      const allIcons = new Set([...existing, ...lucideIcons]);
      const sorted = Array.from(allIcons).sort();
      const newImport = `import {\n  ${sorted.join(',\n  ')},\n} from 'lucide-react'`;
      content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]/, newImport);
    }
  }
  
  // 5. Substituir <HugeiconsIcon icon={XxxIcon} size={N} /> → <Xxx size={N} />
  // Pattern: <HugeiconsIcon icon={IconName} size={N} className="..." />
  content = content.replace(
    /<HugeiconsIcon\s+icon=\{(\w+)\}\s+size=\{(\d+)\}(?:\s+className="([^"]*)")?\s*\/>/g,
    (_, iconName: string, size: string, className: string) => {
      const lucide = ICON_MAP[iconName] || iconName.replace(/Icon$/, '');
      const cls = className ? ` className="${className}"` : '';
      return `<${lucide} size={${size}}${cls} />`;
    }
  );
  
  // Pattern reversed order: icon after className  
  content = content.replace(
    /<HugeiconsIcon\s+className="([^"]*)"\s+icon=\{(\w+)\}\s+size=\{(\d+)\}\s*\/>/g,
    (_, className: string, iconName: string, size: string) => {
      const lucide = ICON_MAP[iconName] || iconName.replace(/Icon$/, '');
      return `<${lucide} size={${size}} className="${className}" />`;
    }
  );
  
  // Multi-line HugeiconsIcon
  content = content.replace(
    /<HugeiconsIcon\s*\n\s*icon=\{(\w+)\}\s*\n\s*size=\{(\d+)\}\s*\n\s*className=\{([^}]+)\}\s*\n\s*\/>/g,
    (_, iconName: string, size: string, classExpr: string) => {
      const lucide = ICON_MAP[iconName] || iconName.replace(/Icon$/, '');
      return `<${lucide}\n              size={${size}}\n              className={${classExpr}}\n            />`;
    }
  );
  
  // 6. Substituir tipos LucideIcon → LucideIcon
  content = content.replace(/LucideIcon/g, 'LucideIcon');
  
  // Adicionar import de LucideIcon se necessário
  if (content.includes('LucideIcon') && !content.includes("import type { LucideIcon }") && !content.includes("type LucideIcon")) {
    // Verifica se já está no import existente de lucide-react
    if (!content.includes('LucideIcon,') && !content.includes('LucideIcon\n')) {
      const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
      if (lucideImportMatch) {
        const existing = lucideImportMatch[1];
        const newImport = existing.trimEnd() + ',\n} from \'lucide-react\'';
        content = content.replace(lucideImportMatch[0], `import {\n  ${existing.split(',').map((s: string) => s.trim()).filter(Boolean).join(',\n  ')},\n} from 'lucide-react'`);
      }
      content = content.replace(
        /from 'lucide-react';/,
        `from 'lucide-react';\nimport type { LucideIcon } from 'lucide-react';`
      );
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  
  return false;
}

// ── Main ──────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..');
const files = findFiles(rootDir, /\.(tsx?|ts)$/);

console.log(`\n🔄 Migrando ${files.length} arquivos de @hugeicons → lucide-react...\n`);

let modified = 0;
for (const file of files) {
  const relPath = path.relative(rootDir, file);
  const changed = processFile(file);
  if (changed) {
    console.log(`  ✅ ${relPath}`);
    modified++;
  }
}

console.log(`\n✨ Migração concluída! ${modified}/${files.length} arquivos modificados.\n`);
