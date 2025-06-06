# TX3 Installer CLI Tool - Project Specification

## Overview

Build a CLI tool that adds TX3 capabilities to existing Next.js projects, similar to how Shadcn UI adds components to projects. The tool should be non-destructive and work as an "installer" rather than a project generator.

## Project Goal

Create a command-line installer that:
- Detects existing Next.js projects
- Adds TX3 functionality without breaking existing code
- Provides a smooth developer experience
- Can be distributed via npm

## Core Requirements

### 1. Package Structure
```
tx3-installer/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   └── install.ts        # Main installation logic
│   ├── templates/
│   │   ├── next-config.ts    # Next.js config template
│   │   ├── generate-script.ts # TX3 generation script
│   │   ├── trix-toml.ts      # Trix configuration template
│   │   └── main-tx3.ts       # Main TX3 file template
│   └── utils/
│       ├── file-utils.ts     # File operations
│       ├── package-utils.ts  # Package.json operations
│       └── validation.ts     # Project validation
└── dist/                     # Compiled output
```

### 2. Package.json Configuration
```json
{
  "name": "install-tx3",
  "bin": {
    "install-tx3": "./dist/index.js"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.0",
    "ora": "^7.0.0"
  }
}
```

## Installation Steps to Automate

The CLI should automate these exact steps that were previously done manually:

### 1. Next.js Configuration Update
Add this webpack configuration to `next.config.ts`:
```typescript
webpack: (config) => {
  // Add alias for @tx3
  config.resolve.alias = {
    ...config.resolve.alias,
    '@tx3': './node_modules/.tx3',
  };

  // Configure webpack to handle TypeScript files in .tx3 directory
  config.module.rules.push({
    test: /\.ts$/,
    include: /node_modules\/\.tx3/,
    use: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          compilerOptions: {
            module: 'esnext',
            target: 'es2017',
            moduleResolution: 'node',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
          },
        },
      },
    ],
  });

  return config;
},
```

### 2. Package Installation
Install these packages:
- `tx3-sdk`
- `tx3-trp` 
- `nodemon`
- `concurrently`

### 3. Package.json Scripts Update
Add these scripts to `package.json`:
```json
{
  "scripts": {
    "tx3:generate": "node scripts/generate-tx3.mjs",
    "watch:tx3": "nodemon --watch tx3 --ext tx3 --exec \"npm run tx3:generate\"",
    "dev": "concurrently \"next dev\" \"npm run watch:tx3\""
  }
}
```

### 4. File Creation
Create these files and directories:

**`scripts/generate-tx3.mjs`:**
```javascript
// scripts/generate-tx3.js
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
    `${process.env.HOME}/.tx3/stable/bin/trix`, // User home directory
    `${process.env.HOME}/.cargo/bin/trix`,
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
        console.log(`Found trix at absolute path: ${trixCommand}`);
        break;
      } else {
        // For relative paths (like 'trix'), use 'which'
        const whichOutput = execSync(`which ${p}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (whichOutput) {
          trixCommand = whichOutput;
          console.log(`Found trix via 'which ${p}': ${trixCommand}`);
          break;
        }
      }
    } catch (e) {
      // console.log(`Did not find trix at ${p}: ${e.message}`);
    }
  }
  
  if (!trixCommand) {
    console.error('trix command not found after checking paths:', trixPaths);
    process.exit(1);
  }
  
  console.log(`Attempting to use trix at: ${trixCommand}`);
  execSync(`${trixCommand} bindgen`, {
    stdio: 'inherit',
    cwd: tx3Dir
  });
}

generateBindings();
```

**`tx3/trix.toml`:** (Template with placeholder content)
**`tx3/main.tx3`:** (Template with placeholder content)

## CLI Features

### Required Features
1. **Project Detection**: Validate that current directory is a Next.js project
2. **Package Manager Detection**: Auto-detect npm/yarn/pnpm and use appropriate commands
3. **Non-destructive Installation**: Add TX3 without breaking existing functionality
4. **Backup Creation**: Backup existing configurations before modification
5. **Error Handling**: Graceful error handling with rollback capability
6. **Status Checking**: Check if TX3 is already installed

### CLI Commands
```bash
# Basic installation
npx install-tx3

# Check current status
install-tx3 --status

# Dry run (preview changes)
install-tx3 --dry-run

# Force reinstall
install-tx3 --force

# Remove TX3 from project
install-tx3 --remove
```

### User Experience Flow
1. User navigates to existing Next.js project directory
2. Runs `npx install-tx3`
3. CLI detects Next.js project and shows what will be modified
4. User confirms installation
5. CLI creates backup, installs packages, updates configs, creates files
6. User gets success message with next steps
7. Developer can immediately use TX3 features alongside existing Next.js app

## Technical Requirements

### Dependencies
- **commander**: CLI framework
- **chalk**: Terminal colors
- **inquirer**: Interactive prompts
- **ora**: Loading spinners
- **typescript**: TypeScript support

### Smart Configuration Merging
- **Next.js Config**: Intelligently merge with existing `next.config.ts/js`
- **Package.json**: Add scripts without overwriting existing ones
- **Dependencies**: Only install missing packages
- **Validation**: Ensure compatibility with existing setup

### Safety Features
- **Backup Creation**: Backup modified files to `.tx3-backup/`
- **Rollback Support**: Ability to undo installation
- **Conflict Detection**: Warn about potential conflicts
- **Validation**: Comprehensive project validation before changes

## Success Criteria

### ✅ Installation Success
- TX3 functionality added to existing Next.js project
- Original Next.js functionality preserved and working
- No breaking changes to existing code
- All new TX3 scripts and commands functional

### ✅ Developer Experience
- Clear, colored terminal output with progress indicators
- Informative error messages with suggested solutions
- Backup and rollback capabilities for safety
- Simple one-command installation process

### ✅ Distribution
- Publishable to npm registry
- Works via `npx install-tx3` without global installation
- Cross-platform compatibility (Windows, macOS, Linux)
- Support for all major package managers

## Example Usage

```bash
# User has existing Next.js project
cd my-existing-nextjs-app

# Install TX3 capabilities
npx install-tx3

# Output:
# 🔍 Checking Next.js project...
# ✅ Next.js project detected!
# 📦 Using package manager: npm
# 📝 Creating backup...
# 🔧 Installing TX3 packages...
# ⚙️ Updating next.config.ts...
# 📜 Adding TX3 scripts...
# 📁 Creating TX3 files...
# 🎉 TX3 installation completed successfully!
#
# Next steps:
# 1. Update tx3/trix.toml with your configuration
# 2. Add your TX3 code to tx3/main.tx3  
# 3. Run "npm run dev" to start development with TX3

# Now the existing Next.js app has TX3 capabilities
npm run dev  # Starts both Next.js and TX3 file watching
```

## Implementation Notes

- Use TypeScript for better development experience
- Implement comprehensive error handling with meaningful messages
- Create modular code structure for easy maintenance
- Add extensive validation to prevent installation issues
- Support both `.ts` and `.js` Next.js configurations
- Handle edge cases like existing webpack configurations
- Provide verbose mode for debugging installation issues

## Deliverables

1. **Complete CLI tool** ready for npm publication
2. **Comprehensive README** with usage instructions
3. **TypeScript source code** with proper typing
4. **Error handling** with rollback capabilities
5. **Cross-platform compatibility** testing
6. **Package.json** configured for npm distribution