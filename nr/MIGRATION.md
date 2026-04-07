# Migration Guide: Adding Blockchain to Existing SSI Project

This guide helps you migrate your existing SSI project to include Ethereum blockchain integration.

## 📋 Prerequisites

Before starting the migration:
- ✅ Backup your existing `data/` directory
- ✅ Ensure Node.js >= 18.0.0 is installed
- ✅ Have an Ethereum wallet with testnet ETH
- ✅ Get API keys from Alchemy or Infura

## 🔄 Migration Steps

### Step 1: Update Dependencies

Add blockchain dependencies to your `package.json`:

```bash
npm install ethers@^6.9.0 dotenv@^16.3.1
npm install --save-dev hardhat@^2.19.4 @nomicfoundation/hardhat-toolbox@^4.0.0
```

### Step 2: Add New Files

Copy these new files to your project:

```
├── blockchainConfig.js          # Blockchain integration layer
├── agentConfig-blockchain.js    # Updated agent config
├── agentManager-blockchain.js   # Updated agent manager
├── contracts/
│   └── SSIRegistry.sol         # Smart contract
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   └── SSIRegistry.test.js     # Contract tests
├── hardhat.config.js           # Hardhat configuration
└── .env.example                # Environment template
```

### Step 3: Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
BLOCKCHAIN_NETWORK=sepolia
USE_BLOCKCHAIN=true
```

### Step 4: Compile and Deploy Contract

```bash
# Compile smart contract
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

Save the deployed contract address - it will be automatically saved to `data/blockchain-config.json`.

### Step 5: Update Your Main Application

Replace imports in your `index.js`:

**Before:**
```javascript
import { AgentManager } from './agentManager.js';
import { CREDENTIAL_SCHEMAS, AGENT_TYPES } from './agentConfig.js';
```

**After:**
```javascript
import { AgentManager } from './agentManager-blockchain.js';
import { CREDENTIAL_SCHEMAS, AGENT_TYPES } from './agentConfig-blockchain.js';
```

Update AgentManager initialization:

**Before:**
```javascript
const agentManager = new AgentManager();
```

**After:**
```javascript
const agentManager = new AgentManager(true, 'sepolia'); // Enable blockchain, use Sepolia
await agentManager.initializeBlockchain();
```

### Step 6: Migrate Existing Data

Run this migration script to add blockchain wallets to existing agents:

```javascript
// migrate-to-blockchain.js
import { AgentManager } from './agentManager-blockchain.js';

async function migrateExistingAgents() {
  const manager = new AgentManager(true, 'sepolia');
  await manager.initializeBlockchain();
  await manager.loadAgents();
  
  const agents = manager.listAgents();
  console.log(`Migrating ${agents.length} agents...`);
  
  for (const agent of agents) {
    try {
      // Create blockchain wallet
      const wallet = await manager.getBlockchainWallet(agent.id);
      console.log(`✅ ${agent.name}: ${wallet.address}`);
      
      // Register DID on blockchain if contract available
      if (manager.blockchain.contract) {
        try {
          await manager.blockchain.registerDID(agent.did, wallet);
          console.log(`   ⛓️  DID registered on blockchain`);
        } catch (error) {
          console.log(`   ⚠️  DID registration skipped: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed for ${agent.name}:`, error.message);
    }
  }
  
  console.log('\n✅ Migration complete!');
}

migrateExistingAgents();
```

Run migration:
```bash
node migrate-to-blockchain.js
```

### Step 7: Add New Menu Options (Optional)

Add blockchain-specific menu options to your CLI:

```javascript
const choices = [
  // ... existing options ...
  
  new inquirer.Separator(chalk.cyan('═══ BLOCKCHAIN ═══')),
  { name: '⛓️  Deploy Contract', value: 'deploy-contract' },
  { name: '📊 Blockchain Stats', value: 'blockchain-stats' },
  { name: '💰 Check Balances', value: 'check-balances' },
  { name: '🚫 Revoke Credential', value: 'revoke-credential' }
];
```

Implement handlers:

```javascript
case 'deploy-contract':
  await deployContractFlow();
  break;
case 'blockchain-stats':
  await showBlockchainStats();
  break;
case 'check-balances':
  await checkAgentBalances();
  break;
case 'revoke-credential':
  await revokeCredentialFlow();
  break;
```

## 🔍 Verification Checklist

After migration, verify:

- [ ] All existing agents loaded successfully
- [ ] Each agent has an Ethereum wallet address
- [ ] Contract is deployed and accessible
- [ ] Can create new agents with blockchain integration
- [ ] Can issue credentials with blockchain anchoring
- [ ] Can verify credentials against blockchain
- [ ] Can revoke credentials on-chain

## 🆕 New Features Available

### 1. Blockchain-Anchored Credentials

```javascript
// Credentials are now automatically anchored on blockchain
const credential = await agentManager.issueCredential(
  hospitalId,
  patientId,
  {
    type: 'VaccinationRecord',
    claims: { vaccine: 'COVID-19', date: '2024-01-15' }
  }
);

// credential.blockchainTx will contain transaction hash
console.log('Blockchain TX:', credential.blockchainTx);
```

### 2. On-Chain Verification

```javascript
// Verification now checks blockchain
const isValid = await agentManager.verifyCredential(verifierId, credential);

// If credential is revoked on-chain, verification fails
```

### 3. Credential Revocation

```javascript
// Only issuer can revoke
const result = await agentManager.revokeCredential(issuerId, credential);
console.log('Revocation TX:', result.transactionHash);
```

### 4. Blockchain Explorer Integration

```javascript
// Get Etherscan URL for any transaction
const txUrl = agentManager.blockchain.getExplorerUrl('tx', transactionHash);
console.log('View on Etherscan:', txUrl);
```

## 🔙 Rollback Procedure

If you need to rollback to the non-blockchain version:

1. Restore your backup of the `data/` directory
2. Revert imports in `index.js` to original versions
3. Remove blockchain-related dependencies:
   ```bash
   npm uninstall ethers hardhat @nomicfoundation/hardhat-toolbox
   ```
4. Delete blockchain-related files:
   ```bash
   rm -rf contracts/ scripts/ test/ hardhat.config.js .env
   ```

## ⚠️ Important Notes

### Gas Costs
- Every blockchain operation costs gas (ETH)
- Testnet ETH is free from faucets
- Plan gas budget for mainnet deployment

### Network Reliability
- Blockchain operations require network connection
- Implement proper error handling
- Consider fallback to off-chain only mode

### Data Privacy
- Only credential hashes go on-chain
- Actual credential data stays in local wallets
- Never put PII directly on blockchain

### Performance
- Blockchain writes take 12-15 seconds on Ethereum
- Consider batch operations for multiple credentials
- Verification (reads) are instant and free

## 🚀 Best Practices

### 1. Gradual Rollout
- Test thoroughly on Sepolia testnet first
- Use blockchain features for new credentials initially
- Keep existing credentials working without blockchain

### 2. Error Handling
```javascript
try {
  await agentManager.issueCredential(issuerId, subjectId, data);
} catch (error) {
  if (error.message.includes('blockchain')) {
    // Blockchain failed, but credential still saved locally
    console.log('Credential saved locally, blockchain unavailable');
  } else {
    throw error;
  }
}
```

### 3. User Communication
- Inform users about blockchain integration
- Explain gas costs and transaction times
- Provide blockchain explorer links for transparency

### 4. Monitoring
- Log all blockchain transactions
- Monitor gas prices
- Track contract interaction success rates
- Set up alerts for failures

## 📈 Next Steps

After successful migration:

1. **Test Everything**
   - Create test agents
   - Issue test credentials
   - Verify and revoke
   
2. **Monitor Performance**
   - Track transaction times
   - Monitor gas costs
   - Check success rates

3. **Educate Users**
   - Document new features
   - Provide training materials
   - Create usage examples

4. **Plan Scaling**
   - Consider Layer 2 solutions
   - Evaluate batch operations
   - Optimize gas usage

## 🆘 Troubleshooting Migration Issues

### Issue: "Cannot find module 'ethers'"
**Solution:** 
```bash
npm install ethers@^6.9.0
```

### Issue: "Contract deployment failed"
**Solution:**
- Check your wallet has testnet ETH
- Verify RPC URL is correct
- Ensure PRIVATE_KEY is valid (no 0x prefix)

### Issue: "Existing agents not loading"
**Solution:**
- Check data directory permissions
- Verify registry.json is intact
- Run migration script again

### Issue: "Gas estimation failed"
**Solution:**
- Ensure contract is compiled: `npx hardhat compile`
- Check network connection
- Verify contract address in config

## 📞 Support

If you encounter issues during migration:
1. Check the troubleshooting section
2. Review Hardhat and Ethers.js documentation
3. Ensure all prerequisites are met
4. Open an issue with detailed error messages

---

**Note:** This migration maintains backward compatibility. Your existing SSI system continues to work, with blockchain features added as an optional enhancement.
