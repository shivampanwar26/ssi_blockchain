#!/usr/bin/env node

/**
 * Setup Script for SSI Blockchain Project
 * Helps configure the project for first-time use
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function banner() {
  console.clear();
  log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║     SSI BLOCKCHAIN PROJECT SETUP                          ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  console.log('');
}

async function checkNodeVersion() {
  log('🔍 Checking Node.js version...', 'cyan');
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    log(`❌ Node.js ${version} detected. Please upgrade to >= 18.0.0`, 'red');
    return false;
  }
  
  log(`✅ Node.js ${version} is compatible`, 'green');
  return true;
}

async function checkNpmInstalled() {
  log('\n🔍 Checking npm...', 'cyan');
  try {
    const { stdout } = await execAsync('npm --version');
    log(`✅ npm ${stdout.trim()} is installed`, 'green');
    return true;
  } catch {
    log('❌ npm is not installed', 'red');
    return false;
  }
}

async function installDependencies() {
  log('\n📦 Installing dependencies...', 'cyan');
  log('This may take a few minutes...', 'yellow');
  
  try {
    await execAsync('npm install', { maxBuffer: 1024 * 1024 * 10 });
    log('✅ Dependencies installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    console.error(error.message);
    return false;
  }
}

async function createEnvFile() {
  log('\n📝 Setting up environment variables...', 'cyan');
  
  try {
    // Check if .env already exists
    try {
      await fs.access('.env');
      const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        log('✅ Keeping existing .env file', 'green');
        return true;
      }
    } catch {
      // .env doesn't exist, proceed
    }

    log('\nPlease provide the following information:', 'yellow');
    log('(Press Enter to use default values)', 'yellow');
    console.log('');

    // Get user inputs
    const sepoliaRpc = await question('Sepolia RPC URL [https://eth-sepolia.g.alchemy.com/v2/demo]: ') || 
                       'https://eth-sepolia.g.alchemy.com/v2/demo';
    
    const privateKey = await question('Private Key (optional, leave empty to generate): ');
    
    const etherscanKey = await question('Etherscan API Key (optional): ') || '';
    
    const walletPassword = await question('Wallet Password [demo-password-change-in-production]: ') || 
                          'demo-password-change-in-production';
    
    const network = await question('Blockchain Network [sepolia]: ') || 'sepolia';

    // Create .env content
    const envContent = `# Ethereum Network Configuration
SEPOLIA_RPC_URL=${sepoliaRpc}
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-ALCHEMY-API-KEY

# Private Key for deployment
${privateKey ? `PRIVATE_KEY=${privateKey}` : '# PRIVATE_KEY=your_private_key_here'}

# Etherscan API Key
ETHERSCAN_API_KEY=${etherscanKey}

# Wallet Password
WALLET_PASSWORD=${walletPassword}

# Gas Reporter
REPORT_GAS=false
COINMARKETCAP_API_KEY=

# Network Selection
BLOCKCHAIN_NETWORK=${network}

# Application Configuration
USE_BLOCKCHAIN=true
`;

    await fs.writeFile('.env', envContent);
    log('\n✅ .env file created successfully', 'green');
    
    if (!privateKey) {
      log('\n⚠️  No private key provided. You will need to add one to deploy contracts.', 'yellow');
      log('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"', 'yellow');
    }
    
    return true;
  } catch (error) {
    log('❌ Failed to create .env file', 'red');
    console.error(error.message);
    return false;
  }
}

async function compileContracts() {
  log('\n🔨 Compiling smart contracts...', 'cyan');
  
  try {
    await execAsync('npx hardhat compile');
    log('✅ Contracts compiled successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to compile contracts', 'red');
    console.error(error.message);
    return false;
  }
}

async function showNextSteps() {
  console.log('');
  log('╔═══════════════════════════════════════════════════════════╗', 'green');
  log('║              SETUP COMPLETE! 🎉                           ║', 'green');
  log('╚═══════════════════════════════════════════════════════════╝', 'green');
  console.log('');
  
  log('Next Steps:', 'bright');
  console.log('');
  
  log('1️⃣  Get testnet ETH from a faucet:', 'cyan');
  log('   https://sepoliafaucet.com/', 'yellow');
  console.log('');
  
  log('2️⃣  Deploy the smart contract:', 'cyan');
  log('   npm run deploy:sepolia', 'yellow');
  console.log('');
  
  log('3️⃣  Start the application:', 'cyan');
  log('   npm start', 'yellow');
  console.log('');
  
  log('📚 For more information:', 'cyan');
  log('   • Read README.md for detailed documentation', 'yellow');
  log('   • Check MIGRATION.md if upgrading from non-blockchain version', 'yellow');
  log('   • Review .env.example for all configuration options', 'yellow');
  console.log('');
  
  log('💡 Pro Tips:', 'cyan');
  log('   • Use Sepolia testnet for testing (it\'s free!)', 'yellow');
  log('   • Keep your private key secure and never commit it', 'yellow');
  log('   • Monitor gas prices before deploying to mainnet', 'yellow');
  console.log('');
}

async function runSetup() {
  banner();
  
  // Step 1: Check prerequisites
  const nodeOk = await checkNodeVersion();
  if (!nodeOk) {
    log('\n❌ Setup cannot continue. Please upgrade Node.js.', 'red');
    process.exit(1);
  }
  
  const npmOk = await checkNpmInstalled();
  if (!npmOk) {
    log('\n❌ Setup cannot continue. Please install npm.', 'red');
    process.exit(1);
  }
  
  // Step 2: Install dependencies
  const answer = await question('\n📦 Install npm dependencies? (Y/n): ');
  if (answer.toLowerCase() !== 'n') {
    const depsOk = await installDependencies();
    if (!depsOk) {
      log('\n⚠️  Dependency installation failed. You may need to run "npm install" manually.', 'yellow');
    }
  }
  
  // Step 3: Create .env file
  const envAnswer = await question('\n📝 Set up environment variables? (Y/n): ');
  if (envAnswer.toLowerCase() !== 'n') {
    await createEnvFile();
  }
  
  // Step 4: Compile contracts
  const compileAnswer = await question('\n🔨 Compile smart contracts? (Y/n): ');
  if (compileAnswer.toLowerCase() !== 'n') {
    const compileOk = await compileContracts();
    if (!compileOk) {
      log('\n⚠️  Contract compilation failed. You may need to run "npx hardhat compile" manually.', 'yellow');
    }
  }
  
  // Show next steps
  await showNextSteps();
  
  rl.close();
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled by user');
  process.exit(0);
});

// Run setup
runSetup().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});
