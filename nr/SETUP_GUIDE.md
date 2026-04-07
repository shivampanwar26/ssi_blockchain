# 🚀 Complete Setup Guide - Step by Step

This guide will walk you through setting up the SSI Blockchain project from scratch.

## ⏱️ Estimated Time: 15-20 minutes

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] Node.js >= 18.0.0 installed
- [ ] npm >= 9.0.0 installed
- [ ] Git installed (optional)
- [ ] A code editor (VS Code recommended)
- [ ] Internet connection

**Check your versions:**
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

---

## 🎯 Step 1: Get the Project Files

You have the complete project in the `ssi-blockchain-project/` directory.

```bash
cd ssi-blockchain-project
```

**Verify you have these files:**
```bash
ls -la

# You should see:
# - index.js
# - package.json
# - hardhat.config.js
# - src/
# - contracts/
# - scripts/
# - test/
# - docs/
```

---

## 📦 Step 2: Install Dependencies

This installs all required packages (may take 2-3 minutes):

```bash
npm install
```

**Expected output:**
```
added 500+ packages in 2m
```

**Verify installation:**
```bash
npx hardhat --version
# Should show: Hardhat version 2.19.4 (or similar)
```

---

## 🔑 Step 3: Create Environment File

### 3.1 Copy the template:
```bash
cp .env.example .env
```

### 3.2 Generate a private key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy the output** - this is your private key (keep it secret!)

### 3.3 Get an Alchemy API Key:

1. Go to https://www.alchemy.com/
2. Sign up for free account
3. Create a new app:
   - Chain: Ethereum
   - Network: Sepolia
4. Copy the API key from the dashboard

### 3.4 Edit `.env` file:

Open `.env` in your editor and fill in:

```env
# Replace YOUR-API-KEY with your actual Alchemy API key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Replace with the private key you generated
PRIVATE_KEY=your_generated_private_key_here

# Optional: Get from https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key

# These can stay as default
WALLET_PASSWORD=demo-password-change-in-production
BLOCKCHAIN_NETWORK=sepolia
USE_BLOCKCHAIN=true
```

**⚠️ NEVER commit the .env file to Git!**

---

## 💰 Step 4: Get Testnet ETH

You need Sepolia ETH to deploy contracts and perform blockchain operations.

### 4.1 Get your Ethereum address:

First, we need to derive your address from the private key:

```bash
node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY'); console.log('Your address:', wallet.address);"
```

Replace `YOUR_PRIVATE_KEY` with your actual key from `.env`

### 4.2 Get free testnet ETH:

Visit any of these faucets and paste your address:

1. **Alchemy Sepolia Faucet** (Recommended)
   - https://sepoliafaucet.com/
   - Login with Alchemy account
   - Get 0.5 SepoliaETH per day

2. **Infura Sepolia Faucet**
   - https://www.infura.io/faucet/sepolia
   - Sign in required
   - Get 0.5 SepoliaETH

3. **QuickNode Faucet**
   - https://faucet.quicknode.com/ethereum/sepolia
   - No sign-in required
   - Get 0.1 SepoliaETH

**Wait 1-2 minutes for the transaction to confirm.**

### 4.3 Verify you received ETH:

Check on Etherscan:
```
https://sepolia.etherscan.io/address/YOUR_ADDRESS
```

You should see a balance > 0 ETH

---

## 🔨 Step 5: Compile Smart Contracts

Compile the Solidity contracts:

```bash
npx hardhat compile
```

**Expected output:**
```
Compiled 1 Solidity file successfully
```

**What this creates:**
- `artifacts/` directory with compiled contracts
- `cache/` directory with compilation cache

---

## 🚀 Step 6: Deploy Smart Contract

Deploy the SSIRegistry contract to Sepolia:

```bash
npm run deploy:sepolia
```

**Expected output:**
```
🚀 Deploying SSIRegistry Contract...

Deploying with account: 0x1234...
Account balance: 0.5 ETH

✅ SSIRegistry deployed to: 0xabcd1234...

📝 Deployment info saved to: ./data/blockchain-config.json

✅ Deployment complete!

Contract Address: 0xabcd1234...
Network: sepolia
```

**⚠️ This costs gas! (~$3-5 USD equivalent in testnet ETH)**

**What this creates:**
- `data/blockchain-config.json` with contract address
- Smart contract deployed on Sepolia blockchain

### 6.1 Verify deployment:

Visit Etherscan:
```
https://sepolia.etherscan.io/address/CONTRACT_ADDRESS
```

You should see your contract with a green checkmark.

---

## ✅ Step 7: Run the Application

Start the CLI application:

```bash
npm start
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║     SSI DYNAMIC AGENTS - BLOCKCHAIN ENABLED ⛓️            ║
╚═══════════════════════════════════════════════════════════╝

⛓️  Blockchain connected: Sepolia Testnet
📊 Current block: 5234567
📜 Using contract at: 0xabcd1234...

No existing agents found. Start by creating your first agent!

? What would you like to do?
```

---

## 🎮 Step 8: Try the Quick Demo

This creates a complete healthcare scenario:

1. In the main menu, select: **"🚀 Quick Demo"**

2. Watch as it:
   - Creates 3 agents (Hospital, Patient, Insurer)
   - Registers their DIDs on blockchain
   - Establishes trust connections
   - Issues credentials
   - Anchors them on blockchain
   - Verifies credentials

**Expected timeline:**
- Creating agents: ~30 seconds (includes blockchain registrations)
- Issuing credentials: ~30 seconds (blockchain transactions)
- **Total: ~1 minute**

---

## 🔍 Step 9: Verify on Blockchain

After the demo, check your transactions on Etherscan:

1. Go to https://sepolia.etherscan.io/address/CONTRACT_ADDRESS
2. Click on "Transactions" tab
3. You should see:
   - DID registrations (3 transactions)
   - Credential issuances (2 transactions)

Each transaction shows:
- ✅ Success status
- Gas used
- Timestamp
- Input data (the function calls)

---

## 📊 Step 10: Explore Features

Try these actions from the main menu:

### Agent Management
1. **Create New Agent**
   - Creates agent with DID and ETH wallet
   - Registers DID on blockchain

2. **List All Agents**
   - Shows all agents with blockchain addresses
   - Displays credential counts

3. **View Agent Details**
   - See full DID, ETH address
   - View credentials and connections

### Credentials
4. **Issue Credential**
   - Create verifiable credential
   - Anchor on blockchain
   - Save to wallet

5. **Verify Credential**
   - Check cryptographic signature
   - Verify on blockchain
   - Check revocation status

6. **Revoke Credential**
   - Mark as revoked on-chain
   - Future verifications will fail

### Blockchain
7. **Check Balances**
   - See ETH balance for each agent
   - Identify which need more gas

8. **Blockchain Info**
   - View contract address
   - See total credentials on-chain
   - Get Etherscan links

---

## 🧪 Step 11: Run Tests

Run the smart contract test suite:

```bash
npm test
```

**Expected output:**
```
  SSIRegistry
    DID Registration
      ✓ Should register a new DID (89ms)
      ✓ Should not allow duplicate DID registration
      ✓ Should track multiple DIDs for same owner
    Credential Issuance
      ✓ Should issue a credential (156ms)
      ✓ Should not allow duplicate credential
    Credential Verification
      ✓ Should verify an existing credential
      ✓ Should return false for non-existent credential
    Credential Revocation
      ✓ Should revoke a credential (98ms)
      ✓ Should only allow issuer to revoke

  9 passing (2s)
```

---

## 🎓 Step 12: Learn More

Now that everything is working, explore:

1. **Read the full documentation:**
   ```bash
   cat docs/README.md
   ```

2. **Understand the code:**
   - `src/blockchainConfig.js` - Blockchain integration
   - `src/agentManager-blockchain.js` - Agent operations
   - `contracts/SSIRegistry.sol` - Smart contract

3. **Check the project structure:**
   ```bash
   cat docs/PROJECT_STRUCTURE.md
   ```

---

## 🔧 Troubleshooting

### Issue: "npm install fails"

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Insufficient funds for gas"

**Solution:**
- Get more Sepolia ETH from faucets (Step 4)
- Each faucet gives 0.1-0.5 ETH
- You need at least 0.1 ETH to deploy

### Issue: "Contract deployment failed"

**Check:**
1. Private key is correct in `.env`
2. Private key has NO `0x` prefix
3. You have enough Sepolia ETH
4. RPC URL is valid

**Debug:**
```bash
# Test connection
npx hardhat run scripts/deploy.js --network sepolia --verbose
```

### Issue: "Cannot connect to network"

**Solution:**
1. Check internet connection
2. Verify Alchemy API key is correct
3. Try different RPC URL:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.public.blastapi.io
   ```

### Issue: "Module not found"

**Solution:**
```bash
# Reinstall dependencies
npm install

# Check Node version
node --version  # Must be >= 18.0.0
```

### Issue: "Blockchain initialization failed"

**Solution:**
1. Check `.env` file exists
2. Verify `USE_BLOCKCHAIN=true`
3. Ensure Alchemy API key is valid
4. Try running without blockchain first:
   ```env
   USE_BLOCKCHAIN=false
   ```

---

## 📱 Quick Reference Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npm test

# Deploy to Sepolia
npm run deploy:sepolia

# Deploy to localhost
npm run node:start      # Terminal 1
npm run deploy:local    # Terminal 2

# Start application
npm start

# Run setup wizard
node src/setup.js

# Clean everything
npm run clean
```

---

## 🎯 Next Steps

Congratulations! You now have a working SSI blockchain system. Here's what to do next:

### For Learning:
1. ✅ Try creating different agent types
2. ✅ Issue various credential types
3. ✅ Test credential revocation
4. ✅ Explore the code in `src/`

### For Development:
1. ✅ Add new credential schemas
2. ✅ Customize the CLI interface
3. ✅ Add more smart contract functions
4. ✅ Build a web interface

### For Production:
1. ✅ Test thoroughly on Sepolia
2. ✅ Audit smart contracts
3. ✅ Plan gas optimization
4. ✅ Deploy to mainnet (when ready!)

---

## 💡 Pro Tips

1. **Save gas**: Batch multiple operations together
2. **Use testnet**: Always test on Sepolia before mainnet
3. **Backup keys**: Keep your private keys safe and backed up
4. **Monitor gas**: Check https://etherscan.io/gastracker
5. **Version control**: Commit code, NEVER commit `.env`

---

## 📚 Resources

- **Ethereum**: https://ethereum.org/developers
- **Hardhat**: https://hardhat.org/tutorial
- **Veramo**: https://veramo.io/
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Etherscan**: https://sepolia.etherscan.io/

---

## 🆘 Getting Help

If you're stuck:

1. Check the troubleshooting section above
2. Read `docs/README.md` for detailed explanations
3. Review `docs/QUICKSTART.md` for quick fixes
4. Check the error message carefully
5. Search for the error on Google/Stack Overflow

---

## ✅ Setup Complete Checklist

Before moving on, verify you've completed:

- [ ] Node.js and npm installed
- [ ] All dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] Received Sepolia testnet ETH
- [ ] Contracts compiled successfully
- [ ] Smart contract deployed to Sepolia
- [ ] Application runs without errors
- [ ] Quick demo completed successfully
- [ ] Tests pass (`npm test`)
- [ ] Can create agents and issue credentials

**If all boxes are checked, you're ready to go! 🎉**

---

**Happy Building!** 🚀

Need help? Review the docs or open an issue on GitHub.
