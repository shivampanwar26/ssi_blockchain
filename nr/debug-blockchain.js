#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

console.log(chalk.cyan.bold('\n🔍 SSI BLOCKCHAIN DEBUGGING TOOL\n'));

const CONTRACT_ADDRESS = '0xE7f2f7eDcA6Fe23bc6d813d4EF876b48B1cBf82E';
const RPC_URL = process.env.SEPOLIA_RPC_URL;

// Test 1: Check RPC Connection
console.log(chalk.yellow('📡 Test 1: Checking RPC Connection...'));
if (!RPC_URL || RPC_URL.includes('demo')) {
  console.log(chalk.red('❌ FAIL: No valid RPC URL in .env file'));
  console.log(chalk.gray('   Add: SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY'));
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

try {
  const blockNumber = await provider.getBlockNumber();
  console.log(chalk.green(`✅ PASS: Connected to Sepolia - Block ${blockNumber}\n`));
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}\n`));
  process.exit(1);
}

// Test 2: Check Contract Exists
console.log(chalk.yellow('📜 Test 2: Checking Smart Contract...'));
try {
  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === '0x') {
    console.log(chalk.red('❌ FAIL: No contract deployed at this address'));
    process.exit(1);
  }
  console.log(chalk.green(`✅ PASS: Contract exists (${code.length} bytes)\n`));
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}\n`));
  process.exit(1);
}

// Test 3: Check Contract ABI
console.log(chalk.yellow('🔧 Test 3: Checking Contract Functions...'));
const abi = [
  "function registerDID(string memory did) public returns (bool)",
  "function issueCredential(bytes32 credentialHash, string memory issuerDID, string memory subjectDID, string memory credentialType) public returns (bool)",
  "function getCredentialCount() public view returns (uint256)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

try {
  const count = await contract.getCredentialCount();
  console.log(chalk.green(`✅ PASS: Contract has ${count} credentials on-chain\n`));
  
  if (count.toString() === '0') {
    console.log(chalk.yellow('⚠️  WARNING: No credentials on blockchain yet - writes may be failing!'));
  }
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}\n`));
}

// Test 4: Check Wallet
console.log(chalk.yellow('💰 Test 4: Checking Deployer Wallet...'));
const DEPLOYER_ADDRESS = '0xA4DDCe7a4f7968A9EfA5B53c3B8751ecD743CD56';

try {
  const balance = await provider.getBalance(DEPLOYER_ADDRESS);
  const ethBalance = ethers.formatEther(balance);
  console.log(chalk.green(`✅ PASS: Deployer has ${ethBalance} ETH`));
  
  if (parseFloat(ethBalance) < 0.001) {
    console.log(chalk.red('❌ CRITICAL: Insufficient ETH for transactions!'));
    console.log(chalk.gray('   Get testnet ETH: https://sepoliafaucet.com/'));
    process.exit(1);
  }
  console.log('');
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}\n`));
}

// Test 5: Check Transaction History
console.log(chalk.yellow('📊 Test 5: Checking Transaction History...'));
try {
  const txCount = await provider.getTransactionCount(DEPLOYER_ADDRESS);
  console.log(chalk.green(`✅ PASS: Deployer has sent ${txCount} transactions`));
  
  if (txCount === 1) {
    console.log(chalk.yellow('⚠️  WARNING: Only 1 transaction (deployment) - no credentials issued yet!'));
  } else if (txCount > 1) {
    console.log(chalk.green(`   Good! ${txCount - 1} transactions after deployment`));
  }
  console.log('');
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}\n`));
}

// Test 6: Test Credential Hash Generation
console.log(chalk.yellow('🔐 Test 6: Testing Hash Generation...'));
const testCredential = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "MedicalBill"],
  "issuer": { "id": "did:key:test123" }
};

const credString = JSON.stringify(testCredential, Object.keys(testCredential).sort());
const hash = ethers.keccak256(ethers.toUtf8Bytes(credString));

console.log(chalk.green(`✅ PASS: Generated hash: ${hash}`));
console.log(chalk.green(`   Length: ${hash.length} characters (should be 66)`));

if (hash.length !== 66) {
  console.log(chalk.red('❌ CRITICAL: Hash length incorrect!'));
  process.exit(1);
}
console.log('');

// Test 7: Check blockchain-config.json
console.log(chalk.yellow('📋 Test 7: Checking Configuration File...'));
try {
  const fs = await import('fs/promises');
  const configContent = await fs.readFile('./data/blockchain-config.json', 'utf-8');
  const config = JSON.parse(configContent);
  
  console.log(chalk.green('✅ PASS: Config file exists'));
  console.log(chalk.gray(`   Contract Address: ${config.contractAddress}`));
  console.log(chalk.gray(`   Network: ${config.network}`));
  
  if (config.contractAddress !== CONTRACT_ADDRESS) {
    console.log(chalk.red('❌ WARNING: Contract address mismatch!'));
    console.log(chalk.gray(`   Expected: ${CONTRACT_ADDRESS}`));
    console.log(chalk.gray(`   Found: ${config.contractAddress}`));
  }
  console.log('');
} catch (error) {
  console.log(chalk.red(`❌ FAIL: ${error.message}`));
  console.log(chalk.gray('   Config file missing or invalid'));
  console.log('');
}

// Test 8: Try a Test Write (with private key)
console.log(chalk.yellow('✍️  Test 8: Testing Write Capability...'));
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY || PRIVATE_KEY.length < 60) {
  console.log(chalk.yellow('⚠️  SKIP: No valid private key in .env'));
  console.log(chalk.gray('   Cannot test write operations without private key'));
} else {
  try {
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    
    console.log(chalk.green(`✅ Wallet loaded: ${wallet.address}`));
    console.log(chalk.green(`   Balance: ${ethers.formatEther(balance)} ETH`));
    
    if (parseFloat(ethers.formatEther(balance)) < 0.001) {
      console.log(chalk.red('❌ CRITICAL: Wallet has insufficient funds!'));
      console.log(chalk.gray(`   Fund this wallet: ${wallet.address}`));
      console.log(chalk.gray('   Get ETH: https://sepoliafaucet.com/'));
    } else {
      console.log(chalk.green('✅ Wallet has sufficient funds for transactions'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ FAIL: ${error.message}`));
  }
}
console.log('');

// Summary
console.log(chalk.cyan.bold('═'.repeat(60)));
console.log(chalk.cyan.bold('DIAGNOSIS SUMMARY'));
console.log(chalk.cyan.bold('═'.repeat(60)));

const credCount = await contract.getCredentialCount();
if (credCount.toString() === '0') {
  console.log(chalk.red('\n❌ PROBLEM FOUND: No credentials on blockchain'));
  console.log(chalk.yellow('\nPossible causes:'));
  console.log('1. Blockchain writes are silently failing');
  console.log('2. Wallet has no ETH for gas fees');
  console.log('3. Code is not actually calling the write functions');
  console.log('4. Transaction is reverting due to smart contract error');
  
  console.log(chalk.cyan('\nNext steps:'));
  console.log('1. Check wallet balance above');
  console.log('2. Enable verbose logging in your app');
  console.log('3. Check for error messages in console');
  console.log('4. Verify .env has correct RPC_URL and PRIVATE_KEY');
} else {
  console.log(chalk.green(`\n✅ SUCCESS: ${credCount} credentials found on blockchain!`));
  console.log(chalk.green('Your system is working correctly!'));
}

console.log('');
console.log(chalk.gray('View contract on Etherscan:'));
console.log(chalk.blue(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`));
console.log('');
