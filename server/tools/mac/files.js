// server/tools/mac/files.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_files',
  description: 'Organize and analyze files. Actions: folder_stats, find_large_files, categorize_files, find_duplicates, organize_folder, move_files, bulk_rename, empty_trash.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['folder_stats', 'find_large_files', 'categorize_files', 'find_duplicates', 'organize_folder', 'move_files', 'bulk_rename', 'empty_trash'] },
      path: { type: 'string', description: 'Target folder path' },
      destination: { type: 'string', description: 'Destination folder (for move_files)' },
      pattern: { type: 'string', description: 'Glob or rename pattern' },
      min_size_mb: { type: 'number', description: 'Minimum size in MB (for find_large_files, default 100)' },
      organize_by: { type: 'string', enum: ['type', 'date'], description: 'How to organize (for organize_folder, default type)' },
    },
    required: ['action'],
  },
};

export const tier = {
  folder_stats: 'read',
  find_large_files: 'read',
  categorize_files: 'read',
  find_duplicates: 'read',
  organize_folder: 'action',
  move_files: 'action',
  bulk_rename: 'action',
  empty_trash: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'folder_stats':     return folderStats(input);
    case 'find_large_files': return findLargeFiles(input);
    case 'categorize_files': return categorizeFiles(input);
    case 'find_duplicates':  return findDuplicates(input);
    case 'organize_folder':  return organizeFolder(input);
    case 'move_files':       return moveFiles(input);
    case 'bulk_rename':      return bulkRename(input);
    case 'empty_trash':      return emptyTrash();
    default: return `Unknown action: ${input.action}`;
  }
}

function resolvePath(p) {
  return p?.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : (p || os.homedir());
}

async function folderStats({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  return new Promise(resolve => {
    exec(`find "${dir}" -maxdepth 1 -type f | wc -l && du -sh "${dir}" 2>/dev/null | cut -f1`, { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      const lines = stdout.trim().split('\n');
      resolve(`Folder: ${dir}\nFiles: ${lines[0]?.trim() || '?'}\nSize: ${lines[1]?.trim() || '?'}`);
    });
  });
}

async function findLargeFiles({ path: dirPath, min_size_mb = 100 }) {
  const dir = resolvePath(dirPath);
  return new Promise(resolve => {
    exec(`find "${dir}" -type f -size +${min_size_mb}M -exec ls -lh {} \\; 2>/dev/null | sort -rk5 | head -20`, { timeout: 30000 }, (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      if (!stdout.trim()) return resolve(`No files larger than ${min_size_mb}MB in ${dir}.`);
      resolve(`Files larger than ${min_size_mb}MB:\n${stdout.trim()}`);
    });
  });
}

async function categorizeFiles({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    const cats = {};
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase() || '(no extension)';
      if (!cats[ext]) cats[ext] = [];
      cats[ext].push(f.name);
    }
    const lines = Object.entries(cats)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([ext, names]) => `${ext}: ${names.length} files`);
    return `File types in ${dir}:\n${lines.join('\n')}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function findDuplicates({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    const sizeMap = {};
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f.name));
      const key = stat.size;
      if (!sizeMap[key]) sizeMap[key] = [];
      sizeMap[key].push(f.name);
    }
    const dupes = Object.entries(sizeMap)
      .filter(([, names]) => names.length > 1)
      .map(([size, names]) => `${names.join(', ')} (${formatSize(parseInt(size))})`);
    if (dupes.length === 0) return `No potential duplicates found in ${dir}.`;
    return `Potential duplicates (same size):\n${dupes.join('\n')}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function organizeFolder({ path: dirPath, organize_by = 'type' }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    let moved = 0;
    for (const f of files) {
      const ext = path.extname(f.name).slice(1).toLowerCase() || 'other';
      let targetDir;
      if (organize_by === 'date') {
        const stat = fs.statSync(path.join(dir, f.name));
        const d = stat.mtime;
        targetDir = path.join(dir, `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
      } else {
        targetDir = path.join(dir, getCategoryForExt(ext));
      }
      fs.mkdirSync(targetDir, { recursive: true });
      fs.renameSync(path.join(dir, f.name), path.join(targetDir, f.name));
      moved++;
    }
    return `Organized ${moved} files in ${dir} by ${organize_by}.`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function moveFiles({ path: srcPath, destination }) {
  if (!srcPath || !destination) return 'Error: path and destination are required.';
  const src = resolvePath(srcPath);
  const dest = resolvePath(destination);
  return new Promise(resolve => {
    fs.mkdirSync(dest, { recursive: true });
    exec(`mv "${src}" "${dest}/"`, (err) => {
      if (err) return resolve(`Error: ${err.message}`);
      resolve(`Moved ${src} to ${dest}/`);
    });
  });
}

async function bulkRename({ path: dirPath, pattern }) {
  if (!pattern) return 'Error: pattern is required (e.g., "photo_{n}" to rename as photo_1, photo_2, ...).';
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile()).sort((a, b) => a.name.localeCompare(b.name));
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i].name);
      const newName = pattern.replace('{n}', i + 1).replace('{name}', path.basename(files[i].name, ext)) + ext;
      fs.renameSync(path.join(dir, files[i].name), path.join(dir, newName));
      count++;
    }
    return `Renamed ${count} files with pattern "${pattern}".`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function emptyTrash() {
  return runAppleScript(`
    tell application "Finder"
      set trashCount to count of items of trash
      if trashCount is 0 then return "Trash is already empty."
      empty the trash
      return "Emptied " & trashCount & " items from Trash."
    end tell
  `.trim());
}

function getCategoryForExt(ext) {
  const map = {
    images: ['jpg','jpeg','png','gif','bmp','svg','webp','heic','tiff','ico'],
    documents: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','rtf','csv','pages','numbers','key'],
    videos: ['mp4','mov','avi','mkv','wmv','flv','webm','m4v'],
    audio: ['mp3','wav','aac','flac','ogg','m4a','wma','aiff'],
    archives: ['zip','tar','gz','rar','7z','dmg','iso'],
    code: ['js','ts','py','rb','go','rs','java','c','cpp','h','css','html','json','xml','yaml','yml','md','sh'],
  };
  for (const [cat, exts] of Object.entries(map)) {
    if (exts.includes(ext)) return cat;
  }
  return 'other';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
