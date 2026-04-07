/**
 * readChain.js — Standalone SSIRegistry reader
 * Reads everything stored on-chain. Zero app code involved.
 * 
 * Run: node --env-file=.env readChain.js [did] [credentialHash]
 */

import { ethers } from 'ethers';
import fs from 'fs/promises';

// ── ABI (only read functions needed) ────────────────────────────────────────
const ABI = [
  "function getCredentialCount() public view returns (uint256)",
  "function getDIDInfo(string did) public view returns (bool, address, uint256)",
  "function getDIDsByOwner(address owner) public view returns (string[] memory)",
  "function getCredential(bytes32 hash) public view returns (bool, uint256, string, string, string, bool, uint256)",
  "function isRevoked(bytes32 hash) public view returns (bool, uint256)",
];

// ── Setup ────────────────────────────────────────────────────────────────────
const provider  = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const config    = JSON.parse(await fs.readFile('./data/blockchain-config.json', 'utf-8'));
const contract  = new ethers.Contract(config.contractAddress, ABI, provider);
const registry  = JSON.parse(await fs.readFile('./data/registry.json', 'utf-8'));

const line  = '─'.repeat(55);
const head  = (t) => console.log(`\n┌${line}┐\n│  ${t.padEnd(53)}│\n└${line}┘`);
const row   = (k, v) => console.log(`  ${chalk(k)}: ${v}`);
const chalk = (s) => `\x1b[36m${s}\x1b[0m`;

// ── 1. Contract overview ─────────────────────────────────────────────────────
head('📜 CONTRACT');
console.log(`  Address : ${config.contractAddress}`);
console.log(`  Network : ${config.network}`);
console.log(`  Deployed: ${config.deployedAt}`);
console.log(`  Deployer: ${config.deployer}`);
console.log(`  TX      : ${config.transactionHash}`);
console.log(`  Block   : ${config.blockNumber}`);

const totalCreds = await contract.getCredentialCount();
console.log(`\n  Total credentials stored on-chain: \x1b[32m${totalCreds}\x1b[0m`);

// ── 2. All agents and their DIDs ─────────────────────────────────────────────
head('👥 AGENTS → DIDs ON-CHAIN');

for (const agent of registry) {
  console.log(`\n  ${agent.name} (${agent.type})`);
  console.log(`  Wallet : ${agent.blockchainAddress || 'none'}`);
  console.log(`  DID    : ${agent.did}`);

  if (agent.did) {
    try {
      const [exists, owner, registeredAt] = await contract.getDIDInfo(agent.did);
      if (exists) {
        console.log(`  \x1b[32m✅ Registered on-chain\x1b[0m`);
        console.log(`     Owner     : ${owner}`);
        console.log(`     Registered: ${new Date(Number(registeredAt) * 1000).toLocaleString()}`);
      } else {
        console.log(`  \x1b[33m⚠️  DID not found on-chain\x1b[0m`);
      }
    } catch (e) {
      console.log(`  \x1b[31m❌ Query failed: ${e.message}\x1b[0m`);
    }
  }
}

// ── 3. All credentials stored on-chain ──────────────────────────────────────
head('📋 CREDENTIALS ON-CHAIN');

// Collect all credential hashes from wallet files
let found = 0;
for (const agent of registry) {
  let credFiles = [];
  try {
    const dir = `./data/wallets/${agent.id}/credentials`;
    const files = await fs.readdir(dir);
    credFiles = files.filter(f => f.endsWith('.json'));
  } catch { continue; }

  for (const file of credFiles) {
    try {
      const raw = await fs.readFile(`./data/wallets/${agent.id}/credentials/${file}`, 'utf-8');
      const cred = JSON.parse(raw);

      if (!cred.blockchainHash) {
        console.log(`\n  ${cred.type} (holder: ${agent.name})`);
        console.log(`  \x1b[33m⚠️  No blockchain hash — issued before contract was deployed\x1b[0m`);
        continue;
      }

      const [exists, storedAt, issuerDID, subjectDID, credType, revoked, revokedAt] =
        await contract.getCredential(cred.blockchainHash);

      found++;
      console.log(`\n  \x1b[32m[${found}] ${credType}\x1b[0m`);
      console.log(`  Hash    : ${cred.blockchainHash.substring(0, 34)}...`);
      console.log(`  Exists  : ${exists}`);
      console.log(`  Stored  : ${new Date(Number(storedAt) * 1000).toLocaleString()}`);
      console.log(`  Issuer  : ${issuerDID.substring(0, 45)}...`);
      console.log(`  Subject : ${subjectDID.substring(0, 45)}...`);
      console.log(`  Revoked : ${revoked ? `\x1b[31mYES (at ${new Date(Number(revokedAt) * 1000).toLocaleString()})\x1b[0m` : '\x1b[32mNo\x1b[0m'}`);
      console.log(`  Local TX: ${cred.blockchainTxHash?.substring(0, 34) || 'N/A'}...`);

    } catch (e) {
      console.log(`  \x1b[31m❌ Failed to read ${file}: ${e.message}\x1b[0m`);
    }
  }
}

if (found === 0) {
  console.log('\n  No credentials with blockchain hashes found.');
  console.log('  Issue a fresh credential after deploying the contract.');
}

// ── 4. DIDs owned by deployer wallet ────────────────────────────────────────
head('🔑 DIDs OWNED BY DEPLOYER WALLET');
try {
  const deployerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
  console.log(`  Wallet: ${deployerWallet.address}`);
  const dids = await contract.getDIDsByOwner(deployerWallet.address);
  if (dids.length === 0) {
    console.log('  No DIDs registered by this wallet.');
  } else {
    dids.forEach((d, i) => console.log(`  [${i+1}] ${d}`));
  }
} catch (e) {
  console.log(`  \x1b[31m❌ ${e.message}\x1b[0m`);
}

console.log('\n');