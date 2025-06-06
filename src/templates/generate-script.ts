export const generateScriptTemplate = `// scripts/generate-tx3.js
import { execSync } from 'child_process';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';
// load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function generateBindings() {
  // Create output directory if it doesn't exist
  const outputDir = path.resolve(process.cwd(), 'tx3/bindings');
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Run trix bindgen from within the tx3 directory
  const tx3Dir = path.resolve(process.cwd(), 'tx3');

  // Try to find trix in common locations
  const trixPaths = [
    'trix', // Check if it's in PATH first
    \`\${process.env.HOME}/.tx3/stable/bin/trix\`, // User home directory
    \`\${process.env.HOME}/.cargo/bin/trix\`,
    '/vercel/.tx3/stable/bin/trix', // Vercel environment
    '/vercel/.cargo/bin/trix',
    '/root/.tx3/stable/bin/trix', // Root location (for Docker)
    '/root/.cargo/bin/trix' 
  ];
  
  let trixCommand = null;
  for (const p of trixPaths) {
    try {
      // For absolute paths, check existence and executability directly
      if (path.isAbsolute(p)) {
        fs.accessSync(p, fs.constants.X_OK);
        trixCommand = p;
        console.log(\`Found trix at absolute path: \${trixCommand}\`);
        break;
      } else {
        // For relative paths (like 'trix'), use 'which'
        const whichOutput = execSync(\`which \${p}\`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (whichOutput) {
          trixCommand = whichOutput;
          console.log(\`Found trix via 'which \${p}': \${trixCommand}\`);
          break;
        }
      }
    } catch (e) {
      // console.log(\`Did not find trix at \${p}: \${e.message}\`);
    }
  }
  
  if (!trixCommand) {
    console.error('trix command not found after checking paths:', trixPaths);
    process.exit(1);
  }
  
  console.log(\`Attempting to use trix at: \${trixCommand}\`);
  execSync(\`\${trixCommand} bindgen\`, {
    stdio: 'inherit',
    cwd: tx3Dir
  });
}

generateBindings();
`;