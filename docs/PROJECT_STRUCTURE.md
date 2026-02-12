# 📁 SSI Blockchain Project Structure

## Complete Directory Layout

```
ssi-blockchain-project/
│
├── 📄 index.js                    # Main application entry point
├── 📄 package.json                # Project dependencies
├── 📄 hardhat.config.js           # Blockchain configuration
├── 📄 .env.example                # Environment template
├── 📄 .gitignore                  # Git ignore rules
│
├── 📂 src/                        # Source code
│   ├── agentConfig-blockchain.js  # Agent configuration
│   ├── agentManager-blockchain.js # Agent management logic
│   ├── blockchainConfig.js        # Blockchain integration
│   └── setup.js                   # Setup wizard
│
├── 📂 contracts/                  # Smart contracts
│   └── SSIRegistry.sol            # Main SSI contract
│
├── 📂 scripts/                    # Deployment scripts
│   └── deploy.js                  # Contract deployment
│
├── 📂 test/                       # Test files
│   └── SSIRegistry.test.js        # Contract tests
│
├── 📂 docs/                       # Documentation
│   ├── README.md                  # Complete guide
│   ├── QUICKSTART.md              # 5-minute setup
│   └── MIGRATION.md               # Upgrade guide
│
└── 📂 data/                       # Runtime data (auto-created)
    ├── wallets/                   # Agent wallets
    │   └── [agent-id]/
    │       ├── agent.db           # Veramo database
    │       ├── credentials/       # Stored credentials
    │       ├── connections/       # Trust connections
    │       ├── blockchain/        # Blockchain info
    │       └── ethereum-wallet.json  # Encrypted ETH wallet
    ├── registry.json              # Agent registry
    ├── blockchain-config.json     # Contract addresses
    └── .master.key               # Encryption key (NEVER commit!)
```

## 📋 File Descriptions

### Root Level Files

| File | Purpose |
|------|---------|
| `index.js` | Main CLI application with blockchain features |
| `package.json` | NPM dependencies and scripts |
| `hardhat.config.js` | Ethereum network and compiler configuration |
| `.env.example` | Template for environment variables |
| `.gitignore` | Files to exclude from version control |

### Source Files (`src/`)

| File | Purpose |
|------|---------|
| `blockchainConfig.js` | Ethereum provider, wallet management, contract interaction |
| `agentConfig-blockchain.js` | Veramo agent setup with blockchain integration |
| `agentManager-blockchain.js` | Agent CRUD, credential operations, blockchain anchoring |
| `setup.js` | Interactive setup wizard for first-time configuration |

### Smart Contracts (`contracts/`)

| File | Purpose |
|------|---------|
| `SSIRegistry.sol` | On-chain registry for DIDs and credentials |

### Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `deploy.js` | Automated contract deployment to any network |

### Tests (`test/`)

| File | Purpose |
|------|---------|
| `SSIRegistry.test.js` | Comprehensive contract test suite |

### Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `README.md` | Complete project documentation |
| `QUICKSTART.md` | Fast setup guide |
| `MIGRATION.md` | Upgrade guide for existing projects |

## 🔄 Data Flow

```
User Interaction (CLI)
        ↓
   index.js
        ↓
  AgentManager
        ↓
    ┌───┴────┐
    ↓        ↓
Veramo    Blockchain
(Off-chain) (On-chain)
    ↓        ↓
Local DB  Ethereum
          Contract
```

## 🔐 Security Layers

```
┌─────────────────────────────────────┐
│  Credential Data                    │
│  (Patient medical records, etc.)    │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 1: Cryptographic Signature   │
│  (Ed25519 - Veramo)                 │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 2: Local Encryption          │
│  (AES-256 - Wallet storage)         │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 3: Blockchain Anchoring      │
│  (Immutable hash on Ethereum)       │
└─────────────────────────────────────┘
```

## 📦 Installation Flow

```
1. Clone/Download Project
        ↓
2. npm install
        ↓
3. Copy .env.example → .env
        ↓
4. Add API keys to .env
        ↓
5. Get testnet ETH
        ↓
6. npx hardhat compile
        ↓
7. npm run deploy:sepolia
        ↓
8. npm start
        ↓
   Ready to use! 🎉
```

## 🎯 Component Relationships

```
                  ┌──────────────┐
                  │   index.js   │
                  │  (Main App)  │
                  └───────┬──────┘
                          │
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
  ┌─────────────┐  ┌─────────────┐  ┌────────────┐
  │AgentManager │  │AgentConfig  │  │Blockchain  │
  │             │  │             │  │Config      │
  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘
         │                │               │
         ↓                ↓               ↓
  ┌─────────────┐  ┌─────────────┐  ┌────────────┐
  │   Veramo    │  │   SQLite    │  │  Ethers.js │
  │   Agent     │  │   Database  │  │  Provider  │
  └─────────────┘  └─────────────┘  └─────┬──────┘
                                           │
                                           ↓
                                    ┌────────────┐
                                    │  Ethereum  │
                                    │  Network   │
                                    └────────────┘
```

## 🔧 Configuration Files

### `.env` (Create from .env.example)
```env
SEPOLIA_RPC_URL=https://...
PRIVATE_KEY=your_key
BLOCKCHAIN_NETWORK=sepolia
USE_BLOCKCHAIN=true
```

### `hardhat.config.js`
```javascript
networks: {
  sepolia: { ... },
  localhost: { ... },
  mainnet: { ... }
}
```

### `package.json`
```json
scripts: {
  "start": "node index.js",
  "deploy:sepolia": "hardhat run scripts/deploy.js --network sepolia"
}
```

## 📊 Data Storage Strategy

| Data Type | Storage Location | Why? |
|-----------|------------------|------|
| Full Credentials | Local wallet (encrypted) | Privacy |
| Credential Hashes | Blockchain | Verification |
| DIDs | Both | Decentralization |
| Private Keys | Local (encrypted) | Security |
| Metadata | Local database | Performance |

## 🚀 Deployment Workflow

```
Development → Testing → Staging → Production

Local        Sepolia    Sepolia    Mainnet
Hardhat      Testnet    Testnet    ($$$$)
  ↓            ↓          ↓          ↓
Test         Test       Final      Live
Changes      Integration Testing   Deploy
  ↓            ↓          ↓          ↓
Free         Free       Free       Costs
Fast         Slower     Slower     Real ETH
```

## 🔍 Where to Find Things

### Need to... | Look here...
- Modify blockchain logic? | `src/blockchainConfig.js`
- Change agent behavior? | `src/agentManager-blockchain.js`
- Update smart contract? | `contracts/SSIRegistry.sol`
- Add new credential types? | `src/agentConfig-blockchain.js`
- Deploy to new network? | `hardhat.config.js`
- Run tests? | `test/SSIRegistry.test.js`
- Learn how to use? | `docs/README.md`

## 📝 Important Files to NEVER Commit

```
❌ .env                    (Contains private keys!)
❌ data/.master.key        (Encryption key!)
❌ data/wallets/           (Private wallets!)
❌ node_modules/           (Large dependencies)
❌ *.db                    (Database files)
```

These are already in `.gitignore` - just never manually add them!

## ✅ Files to Commit

```
✅ src/**/*.js             (Source code)
✅ contracts/**/*.sol      (Smart contracts)
✅ scripts/**/*.js         (Deployment scripts)
✅ test/**/*.js            (Tests)
✅ docs/**/*.md            (Documentation)
✅ .env.example            (Template only)
✅ package.json            (Dependencies)
✅ hardhat.config.js       (Config)
✅ .gitignore              (Ignore rules)
```

## 🎓 Learning Path

1. **Start here**: `docs/QUICKSTART.md`
2. **Understand basics**: `docs/README.md`
3. **Try the demo**: `npm start` → "Quick Demo"
4. **Read smart contract**: `contracts/SSIRegistry.sol`
5. **Explore code**: `src/` directory
6. **Run tests**: `npm test`
7. **Deploy your own**: Follow deployment guide

## 🔄 Development Cycle

```
1. Write code
   ↓
2. Test locally (npm test)
   ↓
3. Deploy to Sepolia (npm run deploy:sepolia)
   ↓
4. Test on testnet
   ↓
5. Verify on Etherscan
   ↓
6. Document changes
   ↓
7. Commit to git
```

---

**Pro Tip**: Keep this file open as a reference while developing!
