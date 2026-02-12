#!/usr/bin/env node

/**
 * Contract Connection Diagnostic Tool
 * Tests if the contract address is valid and accessible
 */

import 'dotenv/config';
import chalk from 'chalk';
import { ethers } from 'ethers';
import fs from 'fs/promises';

async function loadConfig() {
  try {
    const content = await fs.readFile('./data/blockchain-config.json', 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function diagnoseContract() {
  console.log(chalk.cyan.bold('\n🔍 Contract Connection Diagnostic\n'));
  console.log(chalk.gray('═'.repeat(60)));
  
  // Load config
  console.log(chalk.yellow('\n1. Loading configuration...'));
  const config = await loadConfig();
  
  if (!config.contractAddress) {
    console.log(chalk.red('❌ No contract address found in ./data/blockchain-config.json'));
    console.log(chalk.yellow('\nTo fix:'));
    console.log(chalk.gray('  - Run your main app'));
    console.log(chalk.gray('  - Choose "Deploy Smart Contract" OR "Connect to Contract"'));
    console.log(chalk.gray('  - Enter your deployed contract address\n'));
    process.exit(1);
  }
  
  console.log(chalk.green(`✅ Contract address: ${config.contractAddress}`));
  
  // Connect to provider
  console.log(chalk.yellow('\n2. Connecting to Sepolia...'));
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
  console.log(chalk.gray(`   RPC: ${rpcUrl}`));
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(chalk.green(`✅ Connected - Latest block: ${blockNumber}`));
  } catch (error) {
    console.log(chalk.red(`❌ Provider connection failed: ${error.message}`));
    console.log(chalk.yellow('\nTo fix:'));
    console.log(chalk.gray('  - Check your internet connection'));
    console.log(chalk.gray('  - Try a different RPC URL'));
    console.log(chalk.gray('  - Set SEPOLIA_RPC_URL environment variable\n'));
    process.exit(1);
  }
  
  // Check if contract exists
  console.log(chalk.yellow('\n3. Checking contract deployment...'));
  try {
    const code = await provider.getCode(config.contractAddress);
    
    if (code === '0x') {
      console.log(chalk.red('❌ No contract found at this address!'));
      console.log(chalk.yellow('\nPossible issues:'));
      console.log(chalk.gray('  - Wrong address'));
      console.log(chalk.gray('  - Contract not deployed'));
      console.log(chalk.gray('  - Wrong network (expecting Sepolia)'));
      console.log(chalk.gray(`\nCheck on Etherscan: https://sepolia.etherscan.io/address/${config.contractAddress}\n`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Contract deployed (${code.length} bytes of bytecode)`));
  } catch (error) {
    console.log(chalk.red(`❌ Failed to check contract: ${error.message}\n`));
    process.exit(1);
  }
  
  // Try to connect to contract
  console.log(chalk.yellow('\n4. Testing contract interface...'));
  
  const abi = [
    "function getCredentialCount() public view returns (uint256)",
    "function getDIDInfo(string memory did) public view returns (bool, address, uint256)"
  ];
  
  try {
    const contract = new ethers.Contract(config.contractAddress, abi, provider);
    
    // Test read function
    const count = await contract.getCredentialCount();
    console.log(chalk.green(`✅ Contract interface working`));
    console.log(chalk.gray(`   Credentials on chain: ${count}`));
    
  } catch (error) {
    console.log(chalk.red(`❌ Contract interface error: ${error.message}`));
    console.log(chalk.yellow('\nPossible issues:'));
    console.log(chalk.gray('  - ABI mismatch'));
    console.log(chalk.gray('  - Wrong contract (not SSIRegistry)'));
    console.log(chalk.gray('  - Contract method not available\n'));
    process.exit(1);
  }
  
  // All tests passed
  console.log(chalk.gray('\n' + '═'.repeat(60)));
  console.log(chalk.green.bold('\n✅ ALL DIAGNOSTICS PASSED!\n'));
  console.log(chalk.white('Your contract connection is working correctly.'));
  console.log(chalk.white('You can now run the main test suite:\n'));
  console.log(chalk.cyan('  node test-blockchain-integration.js\n'));
  
  // Additional info
  console.log(chalk.gray('Contract Info:'));
  console.log(chalk.gray(`  Address: ${config.contractAddress}`));
  console.log(chalk.gray(`  Explorer: https://sepolia.etherscan.io/address/${config.contractAddress}`));
  console.log(chalk.gray(`  Network: Sepolia Testnet (Chain ID: 11155111)\n`));
}

// Run diagnostics
diagnoseContract().catch(error => {
  console.error(chalk.red('\n💥 Diagnostic failed:'), error.message);
  console.error(error.stack);
  process.exit(1);
});