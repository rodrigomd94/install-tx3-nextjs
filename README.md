# TX3 Installer CLI

A CLI tool that adds TX3 capabilities to existing Next.js projects, similar to how Shadcn UI adds components to projects. The tool is non-destructive and works as an "installer" rather than a project generator.

## Installation

```bash
# Install globally
npm install -g install-tx3

# Or use directly with npx
npx install-tx3
```

## Usage

Navigate to your existing Next.js project directory and run:

```bash
# Basic installation
npx install-tx3

# Or if installed globally
install-tx3

# Check installation status
install-tx3 --status

# Preview changes without applying them
install-tx3 install --dry-run

# Force reinstall
install-tx3 install --force

# Remove TX3 from project (coming soon)
install-tx3 --remove
```

## What it does

The installer automatically:

1. **Validates** your Next.js project
2. **Installs** required packages: `tx3-sdk`, `tx3-trp`, `nodemon`, `concurrently`
3. **Updates** your `next.config.ts/js` with TX3 webpack configuration
4. **Adds** TX3 scripts to your `package.json`
5. **Creates** TX3 files and directories:
   - `tx3/trix.toml` - TX3 configuration
   - `tx3/main.tx3` - Main TX3 source file
   - `scripts/generate-tx3.mjs` - TX3 generation script

## Next.js Configuration Changes

The installer adds this webpack configuration to your `next.config.ts`:

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

## Package.json Scripts Added

```json
{
  "scripts": {
    "tx3:generate": "node scripts/generate-tx3.mjs",
    "watch:tx3": "nodemon --watch tx3 --ext tx3 --exec \"npm run tx3:generate\"",
    "dev": "concurrently \"next dev --turbopack\" \"npm run watch:tx3\""
  }
}
```

## Safety Features

- **Backup Creation**: All modified files are backed up to `.tx3-backup/`
- **Project Validation**: Ensures you're in a valid Next.js project
- **Conflict Detection**: Warns about potential conflicts
- **Rollback Support**: Automatic rollback on installation failure
- **Non-destructive**: Preserves all existing functionality

## Development Workflow

After installation:

1. Update `tx3/trix.toml` with your TX3 configuration
2. Add your TX3 code to `tx3/main.tx3`
3. Run `npm run dev` to start development with TX3 file watching

The development server will:
- Run your Next.js app
- Watch for changes in TX3 files
- Automatically regenerate TX3 bindings when files change

## Package Manager Support

The installer automatically detects and uses your project's package manager:
- **npm** (default)
- **yarn** (detected by `yarn.lock`)
- **pnpm** (detected by `pnpm-lock.yaml`)

## Requirements

- Node.js 16+
- Existing Next.js project
- Supported package managers: npm, yarn, pnpm

## Examples

### Basic Installation
```bash
cd my-existing-nextjs-app
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
```

### Dry Run Preview
```bash
install-tx3 install --dry-run

# Shows preview of all changes without applying them
```

## Troubleshooting

### "Not a Next.js project" Error
Ensure you're in a directory with:
- A `package.json` file
- Next.js as a dependency
- Typical Next.js project structure (`pages/`, `app/`, or `next.config.*`)

### Webpack Configuration Conflicts
If you have existing webpack configuration, the installer will attempt to merge configurations. For complex setups, manual review may be needed.

### Package Installation Failures
Ensure you have:
- A stable internet connection
- Proper npm/yarn/pnpm configuration
- Sufficient disk space

## License

MIT

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/txpipe/install-tx3).