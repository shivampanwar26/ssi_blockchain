#!/usr/bin/env node

import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

console.log(chalk.cyan.bold('\n💰 AGENT WALLET CHECKER & FUNDER\n'));

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const walletsDir = './data/wallets';

// Get all agent wallet addresses
async function getAgentWallets() {
  const wallets = [];
  
  try {
    const agents = await fs.readdir(walletsDir);
    
    for (const agentId of agents) {
      const walletFile = path.join(walletsDir, agentId, 'keys', 'ethereum-wallet.json');
      
      try {
        const data = await fs.readFile(walletFile, 'utf-8');
        const parsed = JSON.parse(data);
        
        const balance = await provider.getBalance(parsed.address);
        const ethBalance = ethers.formatEther(balance);
        
        wallets.push({
          agentId,
          address: parsed.address,
          balance: ethBalance,
          hasEnough: parseFloat(ethBalance) >= 0.01
        });
      } catch {
        // Skip if wallet file doesn't exist
      }
    }
  } catch (error) {
    console.log(chalk.red('Error reading wallets:', error.message));
  }
  
  return wallets;
}

// Display wallet status
const wallets = await getAgentWallets();

if (wallets.length === 0) {
  console.log(chalk.yellow('⚠️  No agent wallets found!'));
  console.log(chalk.gray('   Create agents first using the app'));
  process.exit(0);
}

console.log(chalk.cyan(`Found ${wallets.length} agent wallet(s):\n`));

const needsFunding = [];

for (const wallet of wallets) {
  const status = wallet.hasEnough ? chalk.green('✅ OK') : chalk.red('❌ NEEDS ETH');
  console.log(`${status} ${chalk.white(wallet.agentId)}`);
  console.log(chalk.gray(`   Address: ${wallet.address}`));
  console.log(chalk.gray(`   Balance: ${wallet.balance} ETH`));
  console.log('');
  
  if (!wallet.hasEnough) {
    needsFunding.push(wallet);
  }
}

// Summary
console.log(chalk.cyan.bold('═'.repeat(60)));
console.log(chalk.cyan.bold('SUMMARY'));
console.log(chalk.cyan.bold('═'.repeat(60)) + '\n');

if (needsFunding.length === 0) {
  console.log(chalk.green('✅ All agent wallets have sufficient ETH!'));
  console.log(chalk.green('   Your system should be able to write to blockchain.\n'));
} else {
  console.log(chalk.red(`❌ ${needsFunding.length} wallet(s) need funding!\n`));
  
  console.log(chalk.yellow('📝 FUNDING OPTIONS:\n'));
  
  console.log(chalk.white.bold('Option 1: Manual (Recommended)'));
  console.log(chalk.gray('Visit https://sepoliafaucet.com/ and request ETH for each address:\n'));
  
  for (const wallet of needsFunding) {
    console.log(chalk.cyan(`${wallet.agentId}:`));
    console.log(chalk.white(`  ${wallet.address}\n`));
  }
  
  console.log(chalk.white.bold('\nOption 2: Transfer from Deployer Wallet'));
  console.log(chalk.gray('Run this script with --transfer flag to automatically transfer'));
  console.log(chalk.gray('0.01 ETH from deployer to each agent wallet:\n'));
  console.log(chalk.cyan('  node check-agent-wallets.js --transfer\n'));
  
  // If --transfer flag is present
  if (process.argv.includes('--transfer')) {
    console.log(chalk.yellow('\n⚠️  TRANSFERRING ETH FROM DEPLOYER...\n'));
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
      console.log(chalk.red('❌ No PRIVATE_KEY in .env file!'));
      process.exit(1);
    }
    
    const deployerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const deployerBalance = await provider.getBalance(deployerWallet.address);
    const requiredTotal = needsFunding.length * 0.01;
    
    console.log(chalk.gray(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`));
    console.log(chalk.gray(`Required: ${requiredTotal} ETH + gas\n`));
    
    if (parseFloat(ethers.formatEther(deployerBalance)) < requiredTotal + 0.005) {
      console.log(chalk.red('❌ Deployer wallet has insufficient funds!'));
      console.log(chalk.gray('   Fund deployer first, then try again.'));
      process.exit(1);
    }
    
    for (const wallet of needsFunding) {
      try {
        console.log(chalk.gray(`Sending 0.01 ETH to ${wallet.agentId}...`));
        
        const tx = await deployerWallet.sendTransaction({
          to: wallet.address,
          value: ethers.parseEther('0.01')
        });
        
        console.log(chalk.gray(`  TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green(`  ✅ Success!\n`));
      } catch (error) {
        console.log(chalk.red(`  ❌ Failed: ${error.message}\n`));
      }
    }
    
    console.log(chalk.green('\n✅ All transfers complete!'));
    console.log(chalk.cyan('Now try running your demo again.\n'));
  }
}

console.log(chalk.gray('═'.repeat(60)));
console.log(chalk.gray('Tip: Each agent needs ~0.01 ETH for ~10 transactions'));
console.log(chalk.gray('═'.repeat(60)) + '\n');
