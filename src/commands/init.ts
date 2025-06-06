import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import { FileUtils } from '../utils/file-utils.js';
import { installCommand } from './install.js';

interface InitOptions {
  projectName?: string;
  dryRun?: boolean;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  console.log(chalk.blue('🚀 Initializing new Next.js project with TX3...'));

  let projectName = options.projectName;
  
  // If no project name provided, ask for it
  if (!projectName) {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'What is your project name?',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    }]);
    projectName = name;
  }

  // Check if directory already exists
  if (FileUtils.directoryExists(projectName!)) {
    console.error(chalk.red(`❌ Directory '${projectName}' already exists`));
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
    await showInitDryRunPreview(projectName!);
    return;
  }

  // Confirm initialization
  const { confirmInit } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmInit',
    message: `Create new Next.js project '${projectName}' with shadcn/ui and TX3?`,
    default: true
  }]);

  if (!confirmInit) {
    console.log(chalk.yellow('Initialization cancelled.'));
    return;
  }

  let spinner = ora();

  try {
    // Step 1: Initialize Next.js project with shadcn
    spinner.start('🏗️  Creating Next.js project with shadcn/ui...');
    await initializeShadcnProject(projectName!);
    spinner.succeed('🏗️  Next.js project with shadcn/ui created');

    // Step 2: Change to the project directory
    console.log(chalk.blue(`📁 Project created in: ${projectName}`));
    process.chdir(projectName!);

    // Step 3: Install TX3
    spinner.start('🔧 Installing TX3 capabilities...');
    await installCommand({ force: true, fresh: true });
    spinner.succeed('🔧 TX3 capabilities installed');

    console.log(chalk.green(`🎉 Project created successfully in '${projectName}'!`));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white(`1. cd ${projectName}`));
    console.log(chalk.white('2. Update tx3/trix.toml with your configuration'));
    console.log(chalk.white('3. Add your TX3 code to tx3/main.tx3'));
    console.log(chalk.white('4. Run "npm run dev" to start development'));

  } catch (error) {
    spinner.fail('❌ Project initialization failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    // Cleanup: remove the project directory if it was created
    try {
      if (projectName && FileUtils.directoryExists(projectName)) {
        console.log(chalk.yellow(`🧹 Cleaning up ${projectName}...`));
        FileUtils.removeDirectory(projectName);
      }
    } catch (cleanupError) {
      console.error(chalk.red(`Failed to cleanup: ${cleanupError}`));
    }
    process.exit(1);
  }
}

async function initializeShadcnProject(projectName: string): Promise<void> {
  try {
    // Create the project directory first
    fs.mkdirSync(projectName, { recursive: true });
    
    // Run shadcn init command inside the project directory
    // This will create a new Next.js project in the specified directory
    const command = `npx shadcn@latest init -t next -y`;
    console.log(chalk.dim(`Running: ${command} (in ${projectName})`));
    
    // Use stdio: 'inherit' to allow interactive prompts from shadcn
    execSync(command, { 
      stdio: 'inherit',
      cwd: projectName // Run inside the project directory
    });
  } catch (error) {
    throw new Error(`Failed to initialize shadcn project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function showInitDryRunPreview(projectName: string): Promise<void> {
  console.log(chalk.blue('Actions that would be taken:'));
  console.log();
  
  console.log(chalk.yellow('📁 Project creation:'));
  console.log(`  • Create directory: ${projectName}`);
  console.log(`  • Run: npx shadcn@latest init -t next -y (in ${projectName})`);
  console.log(`  • This will create a new Next.js project with shadcn/ui`);
  console.log(`  • Change to directory: ${projectName}`);
  
  console.log();
  console.log(chalk.yellow('🔧 TX3 installation:'));
  console.log('  • Install TX3 packages (tx3-sdk, tx3-trp)');
  console.log('  • Install dev dependencies (glob, dotenv, nodemon, concurrently)');
  console.log('  • Add TX3 scripts to package.json');
  console.log('  • Update tsconfig.json with TX3 path mappings');
  console.log('  • Create tx3/ directory and files');
  console.log('  • Create scripts/generate-tx3.mjs');
}