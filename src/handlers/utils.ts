import fs from 'fs';
import path from 'path';

/**
 * Recursively gets all files in a directory
 */
export function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.mjs') || file.endsWith('.cjs')) {
        // Skip TypeScript declaration files
        if (!file.endsWith('.d.ts')) {
          arrayOfFiles.push(fullPath);
        }
      }
    }
  });

  return arrayOfFiles;
}
