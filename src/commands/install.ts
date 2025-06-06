import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ProjectValidator } from '../utils/validation.js';
import { PackageUtils } from '../utils/package-utils.js';
import { FileUtils, BackupEntry } from '../utils/file-utils.js';
import { TrixInstaller } from '../utils/trix-installer.js';
import { DevnetInstaller } from '../utils/devnet-installer.js';
import { generateScriptTemplate } from '../templates/generate-script.js';
import { trixTomlTemplate } from '../templates/trix-toml.js';
import { mainTx3Template } from '../templates/main-tx3.js';

interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
  fresh?: boolean; // For fresh projects created by init command
  verbose?: boolean; // Show more detailed output
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  if (!options.verbose) {
    console.log(chalk.blue('🔍 Checking Next.js project...'));
  }

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

  // Check if trix is already installed (only for non-verbose mode)
  let installTrix = false;
  if (!options.verbose) {
    const trixInstalled = TrixInstaller.checkTrixInstalled();
    
    if (!trixInstalled) {
      const { shouldInstallTrix } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldInstallTrix',
        message: 'Install trix (TX3 compiler) via tx3up? (Recommended for local development)',
        default: true
      }]);
      installTrix = shouldInstallTrix;
    } else {
      console.log(chalk.green('✅ trix is already installed'));
    }
  }

  // Ask about devnet setup if trix is available (only for non-verbose mode)
  let includeDevnet = false;
  if (!options.verbose) {
    const currentTrixInstalled = TrixInstaller.checkTrixInstalled();
    const hasTrix = currentTrixInstalled || installTrix;
    if (hasTrix) {
      const { shouldIncludeDevnet } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldIncludeDevnet',
        message: 'Include devnet setup for local testing? (Adds dolos configuration)',
        default: true
      }]);
      includeDevnet = shouldIncludeDevnet;
    }
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
  let spinner = options.verbose ? null : ora();

  try {
    // Install trix if requested
    if (installTrix) {
      if (spinner) {
        spinner.start('🔧 Installing trix via tx3up...');
      } else {
        console.log(chalk.blue('🔧 Installing trix via tx3up...'));
      }
      
      try {
        await TrixInstaller.installTrix(!spinner);
        if (spinner) {
          spinner.succeed('🔧 trix installed successfully');
        } else {
          console.log(chalk.green('🔧 trix installed successfully'));
        }
      } catch (error) {
        if (spinner) {
          spinner.warn('⚠️ trix installation failed, but continuing with TX3 setup');
        } else {
          console.log(chalk.yellow('⚠️ trix installation failed, but continuing with TX3 setup'));
        }
        console.log(chalk.yellow(`You can install trix manually later with: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh && tx3up`));
      }
    }

    // Create backup
    if (spinner) {
      spinner.start('📝 Creating backup...');
    } else {
      console.log(chalk.blue('📝 Creating backup...'));
    }
    FileUtils.ensureBackupDir();
    
    // Backup files that will be modified
    const filesToBackup = [
      'package.json',
      'tsconfig.json'
    ].filter(file => FileUtils.fileExists(file));

    for (const file of filesToBackup) {
      backups.push(FileUtils.backupFile(file));
    }
    if (spinner) {
      spinner.succeed('📝 Backup created');
    } else {
      console.log(chalk.green('📝 Backup created'));
    }

    // Install packages
    if (spinner) {
      spinner.start('🔧 Installing TX3 packages...');
    } else {
      console.log(chalk.blue('🔧 Installing TX3 packages...'));
    }
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
    if (spinner) {
      spinner.succeed('🔧 TX3 packages installed');
    } else {
      console.log(chalk.green('🔧 TX3 packages installed'));
    }

    // Update tsconfig.json paths
    if (spinner) {
      spinner.start('⚙️ Updating TypeScript configuration...');
    } else {
      console.log(chalk.blue('⚙️ Updating TypeScript configuration...'));
    }
    await updateTsConfig();
    if (spinner) {
      spinner.succeed('⚙️ TypeScript configuration updated');
    } else {
      console.log(chalk.green('⚙️ TypeScript configuration updated'));
    }

    // Add package.json scripts
    if (spinner) {
      spinner.start('📜 Adding TX3 scripts...');
    } else {
      console.log(chalk.blue('📜 Adding TX3 scripts...'));
    }
    const packageJson = PackageUtils.addScripts({
      'tx3:generate': 'node scripts/generate-tx3.mjs',
      'watch:tx3': 'nodemon --watch tx3 --ext tx3 --exec "npm run tx3:generate"',
      'dev': 'concurrently "next dev --turbopack" "npm run watch:tx3"'
    });
    PackageUtils.writePackageJson(packageJson);
    if (spinner) {
      spinner.succeed('📜 TX3 scripts added');
    } else {
      console.log(chalk.green('📜 TX3 scripts added'));
    }

    // Create TX3 files and directories
    if (spinner) {
      spinner.start('📁 Creating TX3 files...');
    } else {
      console.log(chalk.blue('📁 Creating TX3 files...'));
    }
    await createTx3Files();
    if (spinner) {
      spinner.succeed('📁 TX3 files created');
    } else {
      console.log(chalk.green('📁 TX3 files created'));
    }

    // Set up devnet if requested
    if (includeDevnet) {
      if (spinner) {
        spinner.start('🌐 Setting up devnet configuration...');
      } else {
        console.log(chalk.blue('🌐 Setting up devnet configuration...'));
      }
      
      try {
        setupDevnet();
        if (spinner) {
          spinner.succeed('🌐 Devnet configuration created');
        } else {
          console.log(chalk.green('🌐 Devnet configuration created'));
        }
      } catch (error) {
        if (spinner) {
          spinner.warn('⚠️ Devnet setup failed, but continuing with installation');
        } else {
          console.log(chalk.yellow('⚠️ Devnet setup failed, but continuing with installation'));
        }
      }
    }

    console.log(chalk.green('🎉 TX3 installation completed successfully!'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white('1. Update tx3/trix.toml with your configuration'));
    console.log(chalk.white('2. Add your TX3 code to tx3/main.tx3'));
    console.log(chalk.white('3. Run "npm run dev" to start development with TX3'));

  } catch (error) {
    if (spinner) {
      spinner.fail('❌ Installation failed');
    } else {
      console.log(chalk.red('❌ Installation failed'));
    }
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
  
  // Check trix installation status
  const trixInstalled = TrixInstaller.checkTrixInstalled();
  if (!trixInstalled) {
    console.log(chalk.yellow('🔧 trix installation:'));
    console.log('  • Install tx3up installer');
    console.log('  • Run tx3up to install trix');
    console.log();
  }

  // Show devnet setup status
  if (trixInstalled || !trixInstalled) { // Will be prompted if trix available
    console.log(chalk.yellow('🌐 devnet setup (will be prompted if trix available):'));
    console.log('  • Copy devnet configuration files');
    console.log('  • Add devnet:start script to package.json');
    console.log();
  }
  
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

function setupDevnet(): void {
  try {
    // Copy devnet folder to project
    DevnetInstaller.copyDevnetFolder('devnet');
    
    // Add devnet:start script to package.json
    const packageJson = PackageUtils.readPackageJson();
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['devnet:start'] = 'cd devnet && dolos daemon';
    PackageUtils.writePackageJson(packageJson);
    
  } catch (error) {
    throw new Error(`Failed to setup devnet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}