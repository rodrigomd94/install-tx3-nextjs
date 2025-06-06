import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ProjectValidator } from '../utils/validation.js';
import { PackageUtils } from '../utils/package-utils.js';
import { FileUtils, BackupEntry } from '../utils/file-utils.js';
import { generateScriptTemplate } from '../templates/generate-script.js';
import { trixTomlTemplate } from '../templates/trix-toml.js';
import { mainTx3Template } from '../templates/main-tx3.js';

interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
  fresh?: boolean; // For fresh projects created by init command
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  console.log(chalk.blue('🔍 Checking Next.js project...'));

  // Validate project - use different validation for fresh projects
  const validation = options.fresh 
    ? ProjectValidator.validateFreshProject()
    : ProjectValidator.validateNextJsProject();
  
  if (!validation.isValid) {
    console.error(chalk.red('❌ Project validation failed:'));
    validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
    throw new Error('Project validation failed');
  }

  // Show warnings
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('⚠️  Warnings:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
    
    if (!options.force && validation.warnings.some(w => w.includes('TX3 files already exist'))) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'TX3 appears to already be installed. Continue anyway?',
        default: false
      }]);
      
      if (!proceed) {
        console.log(chalk.yellow('Installation cancelled.'));
        return;
      }
    }
  }

  if (options.fresh) {
    console.log(chalk.green('✅ Fresh project ready for TX3 installation!'));
  } else {
    console.log(chalk.green('✅ Next.js project detected!'));
  }

  // Detect package manager
  const packageManager = PackageUtils.detectPackageManager();
  console.log(chalk.blue(`📦 Using package manager: ${packageManager}`));

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
    await showDryRunPreview();
    return;
  }

  // Confirm installation
  const { confirmInstall } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmInstall',
    message: 'Install TX3 capabilities to this Next.js project?',
    default: true
  }]);

  if (!confirmInstall) {
    console.log(chalk.yellow('Installation cancelled.'));
    return;
  }

  const backups: BackupEntry[] = [];
  let spinner = ora();

  try {
    // Create backup
    spinner.start('📝 Creating backup...');
    FileUtils.ensureBackupDir();
    
    // Backup files that will be modified
    const filesToBackup = [
      'package.json',
      'tsconfig.json'
    ].filter(file => FileUtils.fileExists(file));

    for (const file of filesToBackup) {
      backups.push(FileUtils.backupFile(file));
    }
    spinner.succeed('📝 Backup created');

    // Install packages
    spinner.start('🔧 Installing TX3 packages...');
    const requiredPackages = ['tx3-sdk', 'tx3-trp'];
    const requiredDevPackages = ['glob', 'dotenv', 'nodemon', 'concurrently'];
    
    const missingPackages = PackageUtils.getMissingPackages(requiredPackages);
    const missingDevPackages = PackageUtils.getMissingPackages(requiredDevPackages);
    
    if (missingPackages.length > 0) {
      PackageUtils.installPackages(missingPackages);
    }
    
    if (missingDevPackages.length > 0) {
      PackageUtils.installPackages(missingDevPackages, true);
    }
    spinner.succeed('🔧 TX3 packages installed');

    // Update tsconfig.json paths
    spinner.start('⚙️ Updating TypeScript configuration...');
    await updateTsConfig();
    spinner.succeed('⚙️ TypeScript configuration updated');

    // Add package.json scripts
    spinner.start('📜 Adding TX3 scripts...');
    const packageJson = PackageUtils.addScripts({
      'tx3:generate': 'node scripts/generate-tx3.mjs',
      'watch:tx3': 'nodemon --watch tx3 --ext tx3 --exec "npm run tx3:generate"',
      'dev': 'concurrently "next dev --turbopack" "npm run watch:tx3"'
    });
    PackageUtils.writePackageJson(packageJson);
    spinner.succeed('📜 TX3 scripts added');

    // Create TX3 files and directories
    spinner.start('📁 Creating TX3 files...');
    await createTx3Files();
    spinner.succeed('📁 TX3 files created');

    console.log(chalk.green('🎉 TX3 installation completed successfully!'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white('1. Update tx3/trix.toml with your configuration'));
    console.log(chalk.white('2. Add your TX3 code to tx3/main.tx3'));
    console.log(chalk.white('3. Run "npm run dev" to start development with TX3'));

  } catch (error) {
    spinner.fail('❌ Installation failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    // Rollback changes
    console.log(chalk.yellow('🔄 Rolling back changes...'));
    for (const backup of backups) {
      try {
        FileUtils.restoreFromBackup(backup);
      } catch (rollbackError) {
        console.error(chalk.red(`Failed to restore ${backup.originalPath}: ${rollbackError}`));
      }
    }
    console.log(chalk.yellow('🔄 Rollback completed'));
    process.exit(1);
  }
}

async function showDryRunPreview(): Promise<void> {
  console.log(chalk.blue('Changes that would be made:'));
  console.log();
  
  console.log(chalk.yellow('📦 Packages to install:'));
  const requiredPackages = ['tx3-sdk', 'tx3-trp'];
  const requiredDevPackages = ['glob', 'dotenv', 'nodemon', 'concurrently'];
  const missingPackages = PackageUtils.getMissingPackages(requiredPackages);
  const missingDevPackages = PackageUtils.getMissingPackages(requiredDevPackages);
  
  if (missingPackages.length === 0 && missingDevPackages.length === 0) {
    console.log(chalk.green('  • All required packages already installed'));
  } else {
    missingPackages.forEach(pkg => console.log(`  • ${pkg}`));
    missingDevPackages.forEach(pkg => console.log(`  • ${pkg} (dev)`));
  }

  console.log();
  console.log(chalk.yellow('📜 Scripts to add to package.json:'));
  console.log('  • tx3:generate: node scripts/generate-tx3.mjs');
  console.log('  • watch:tx3: nodemon --watch tx3 --ext tx3 --exec "npm run tx3:generate"');
  console.log('  • dev: concurrently "next dev --turbopack" "npm run watch:tx3"');

  console.log();
  console.log(chalk.yellow('📁 Files to create:'));
  console.log('  • tx3/trix.toml');
  console.log('  • tx3/main.tx3');
  console.log('  • scripts/generate-tx3.mjs');

  console.log();
  console.log(chalk.yellow('⚙️ Configuration changes:'));
  console.log('  • Update tsconfig.json with TX3 path mappings');
}

async function updateTsConfig(): Promise<void> {
  const tsconfigPath = 'tsconfig.json';
  
  if (!FileUtils.fileExists(tsconfigPath)) {
    throw new Error('tsconfig.json not found');
  }

  const existingContent = FileUtils.readFile(tsconfigPath);
  let tsconfig;
  
  try {
    tsconfig = JSON.parse(existingContent);
  } catch (error) {
    throw new Error('Failed to parse tsconfig.json');
  }

  // Ensure compilerOptions exists
  if (!tsconfig.compilerOptions) {
    tsconfig.compilerOptions = {};
  }

  // Ensure paths exists
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }

  // Add TX3 path mappings
  tsconfig.compilerOptions.paths["@tx3/*"] = ["./tx3/bindings/*"];
  tsconfig.compilerOptions.paths["@tx3"] = ["./tx3/bindings"];

  // Write updated tsconfig
  FileUtils.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
}

async function createTx3Files(): Promise<void> {
  // Create tx3 directory
  FileUtils.createDirectory('tx3');
  FileUtils.createDirectory('scripts');

  // Create trix.toml
  FileUtils.writeFile('tx3/trix.toml', trixTomlTemplate);

  // Create main.tx3
  FileUtils.writeFile('tx3/main.tx3', mainTx3Template);

  // Create generate script
  FileUtils.writeFile('scripts/generate-tx3.mjs', generateScriptTemplate);
}