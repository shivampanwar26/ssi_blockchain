#!/usr/bin/env node

/**
 * Blockchain Write/Verify Test Script
 * 
 * This script tests the complete blockchain integration:
 * 1. Agent creation with DID registration
 * 2. Credential issuance on blockchain
 * 3. Credential verification from blockchain
 * 
 * Prerequisites:
 * - Smart contract deployed on Sepolia
 * - Contract address in ./data/blockchain-config.json
 * - Test wallets funded with Sepolia ETH
 */

import 'dotenv/config';
import chalk from 'chalk';
import { AgentManager } from './src/agentManager-blockchain.js';

// Configuration
const NETWORK = process.env.BLOCKCHAIN_NETWORK || 'sepolia';
const ENABLE_BLOCKCHAIN = true;

async function displayHeader() {
  console.clear();
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║     BLOCKCHAIN WRITE/VERIFY TEST SUITE                ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════╝'));
  console.log('');
}

async function checkPrerequisites(manager) {
  console.log(chalk.yellow('📋 Checking Prerequisites...\n'));
  
  const checks = [];
  
  // Check 1: Blockchain initialized
  if (manager.blockchain) {
    checks.push({ name: 'Blockchain initialized', status: true });
  } else {
    checks.push({ name: 'Blockchain initialized', status: false, error: 'Not initialized' });
  }
  
  // Check 2: Contract connected
  if (manager.blockchain?.contract) {
    checks.push({ name: 'Smart contract connected', status: true });
    console.log(chalk.gray(`   Contract: ${manager.blockchain.contractAddress}`));
  } else {
    checks.push({ 
      name: 'Smart contract connected', 
      status: false, 
      error: 'No contract address found. Run "Connect to Contract" first.' 
    });
  }
  
  // Check 3: Network
  checks.push({ 
    name: `Network: ${NETWORK}`, 
    status: true 
  });
  
  console.log('');
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    const msg = check.status ? check.name : `${check.name} - ${check.error}`;
    console.log(`${icon} ${msg}`);
  });
  console.log('');
  
  const allPassed = checks.every(c => c.status);
  
  if (!allPassed) {
    console.log(chalk.red('❌ Prerequisites not met. Please fix the issues above.\n'));
    return false;
  }
  
  console.log(chalk.green('✅ All prerequisites met!\n'));
  return true;
}

async function testAgentCreation(manager) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST 1: Agent Creation with DID Registration'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  try {
    // Create hospital
    console.log(chalk.yellow('Creating Hospital Agent...'));
    const hospital = await manager.createAgent('Test City Hospital', 'hospital', {
      description: 'Test hospital for blockchain integration'
    });
    
    console.log(chalk.green('✅ Hospital created'));
    console.log(chalk.gray(`   DID: ${hospital.did}`));
    console.log(chalk.gray(`   Address: ${hospital.blockchainAddress}`));
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create patient
    console.log(chalk.yellow('Creating Patient Agent...'));
    const patient = await manager.createAgent('Test Patient John', 'patient', {
      description: 'Test patient for blockchain integration'
    });
    
    console.log(chalk.green('✅ Patient created'));
    console.log(chalk.gray(`   DID: ${patient.did}`));
    console.log(chalk.gray(`   Address: ${patient.blockchainAddress}`));
    
    console.log('');
    console.log(chalk.green('✅ TEST 1 PASSED: Both agents created successfully\n'));
    
    return { hospital, patient };
  } catch (error) {
    console.log(chalk.red(`❌ TEST 1 FAILED: ${error.message}\n`));
    throw error;
  }
}

async function testConnection(manager, hospital, patient) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST 2: Agent Connection'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  try {
    await manager.connectAgents(hospital.id, patient.id);
    console.log(chalk.green('✅ TEST 2 PASSED: Agents connected successfully\n'));
  } catch (error) {
    console.log(chalk.red(`❌ TEST 2 FAILED: ${error.message}\n`));
    throw error;
  }
}

async function testCredentialIssuance(manager, hospital, patient) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST 3: Credential Issuance on Blockchain'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  try {
    const billData = {
      type: 'MedicalBill',
      claims: {
        billNumber: `TEST-${Date.now()}`,
        patientName: 'Test Patient John',
        diagnosis: 'Test Diagnosis - Blockchain Integration',
        treatment: 'Test Treatment - Verification',
        amount: '$500.00',
        date: new Date().toISOString().split('T')[0],
        issuedDate: new Date().toISOString()
      }
    };
    
    console.log(chalk.yellow('Issuing Medical Bill Credential...'));
    const credential = await manager.issueCredential(
      hospital.id,
      patient.id,
      billData
    );
    
    console.log(chalk.green('✅ TEST 3 PASSED: Credential issued successfully\n'));
    
    return credential;
  } catch (error) {
    console.log(chalk.red(`❌ TEST 3 FAILED: ${error.message}\n`));
    console.error(error.stack);
    throw error;
  }
}

async function testCredentialVerification(manager, patient, credential) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST 4: Credential Verification from Blockchain'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  try {
    console.log(chalk.yellow('Verifying credential...'));
    
    // Small delay to ensure blockchain has processed the transaction
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const isValid = await manager.verifyCredential(patient.id, credential);
    
    if (isValid) {
      console.log(chalk.green('✅ TEST 4 PASSED: Credential verified successfully\n'));
    } else {
      throw new Error('Verification returned false');
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ TEST 4 FAILED: ${error.message}\n`));
    throw error;
  }
}

async function testBlockchainData(manager) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST 5: Blockchain State Verification'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  try {
    if (manager.blockchain?.contract) {
      const credentialCount = await manager.blockchain.getCredentialCount();
      console.log(chalk.green(`✅ Total credentials on blockchain: ${credentialCount}`));
      
      if (credentialCount > 0) {
        console.log(chalk.green('✅ TEST 5 PASSED: Blockchain state verified\n'));
      } else {
        console.log(chalk.yellow('⚠️  Warning: No credentials found on blockchain\n'));
      }
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️  TEST 5 SKIPPED: ${error.message}\n`));
  }
}

async function displaySummary(results) {
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log(chalk.cyan.bold('TEST SUMMARY'));
  console.log(chalk.cyan.bold('═'.repeat(60)));
  console.log('');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });
  
  console.log('');
  console.log(chalk.white.bold(`Tests Passed: ${passed}/${total}`));
  
  if (passed === total) {
    console.log('');
    console.log(chalk.green.bold('🎉 ALL TESTS PASSED! 🎉'));
    console.log(chalk.green('Your blockchain integration is working correctly!'));
    console.log('');
  } else {
    console.log('');
    console.log(chalk.red.bold('⚠️  SOME TESTS FAILED'));
    console.log(chalk.yellow('Please check the error messages above and fix the issues.'));
    console.log('');
  }
}

async function cleanup(manager, hospital, patient) {
  console.log(chalk.gray('\n🧹 Cleaning up test data...'));
  
  try {
    if (hospital) await manager.deleteAgent(hospital.id);
    if (patient) await manager.deleteAgent(patient.id);
    console.log(chalk.gray('✅ Cleanup complete\n'));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Cleanup warning: ${error.message}\n`));
  }
}

async function main() {
  await displayHeader();
  
  const manager = new AgentManager(ENABLE_BLOCKCHAIN, NETWORK);
  const results = [];
  
  let hospital = null;
  let patient = null;
  let credential = null;
  
  try {
    // Initialize
    console.log(chalk.yellow('Initializing blockchain...\n'));
    await manager.initializeBlockchain();
    
    // Load existing agents
    await manager.loadAgents();
    
    // Check prerequisites
    const prereqsPassed = await checkPrerequisites(manager);
    
    if (!prereqsPassed) {
      console.log(chalk.yellow('Please fix prerequisites and run again.'));
      console.log(chalk.gray('\nHints:'));
      console.log(chalk.gray('1. Deploy contract: Choose "Deploy Smart Contract" in main menu'));
      console.log(chalk.gray('2. Fund wallets: Get Sepolia ETH from https://sepoliafaucet.com/'));
      console.log(chalk.gray('3. Connect contract: Use "Connect to Contract" if already deployed\n'));
      process.exit(1);
    }
    
    // Test 1: Agent Creation
    try {
      const agents = await testAgentCreation(manager);
      hospital = agents.hospital;
      patient = agents.patient;
      results.push({ name: 'Agent Creation with DID Registration', passed: true });
    } catch (error) {
      results.push({ name: 'Agent Creation with DID Registration', passed: false });
    }
    
    // Test 2: Connection
    if (hospital && patient) {
      try {
        await testConnection(manager, hospital, patient);
        results.push({ name: 'Agent Connection', passed: true });
      } catch (error) {
        results.push({ name: 'Agent Connection', passed: false });
      }
    }
    
    // Test 3: Credential Issuance
    if (hospital && patient) {
      try {
        credential = await testCredentialIssuance(manager, hospital, patient);
        results.push({ name: 'Credential Issuance on Blockchain', passed: true });
      } catch (error) {
        results.push({ name: 'Credential Issuance on Blockchain', passed: false });
      }
    }
    
    // Test 4: Verification
    if (patient && credential) {
      try {
        await testCredentialVerification(manager, patient, credential);
        results.push({ name: 'Credential Verification from Blockchain', passed: true });
      } catch (error) {
        results.push({ name: 'Credential Verification from Blockchain', passed: false });
      }
    }
    
    // Test 5: Blockchain State
    await testBlockchainData(manager);
    
    // Display summary
    await displaySummary(results);
    
    // Cleanup
    const shouldCleanup = process.argv.includes('--cleanup');
    if (shouldCleanup) {
      await cleanup(manager, hospital, patient);
    } else {
      console.log(chalk.gray('Test agents preserved. Run with --cleanup to remove them.\n'));
    }
    
  } catch (error) {
    console.log(chalk.red('\n❌ FATAL ERROR:'), error.message);
    console.error(error.stack);
    
    if (hospital || patient) {
      await cleanup(manager, hospital, patient);
    }
    
    process.exit(1);
  }
}

// Run the test suite
main().catch(error => {
  console.error(chalk.red('\n💥 Unhandled error:'), error);
  process.exit(1);
});