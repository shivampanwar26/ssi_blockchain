# SSI Dynamic Agents with Ethereum Blockchain Integration

A Self-Sovereign Identity (SSI) system that combines Veramo framework with Ethereum blockchain for decentralized identity and credential management in healthcare scenarios.

## 🌟 Features

### Core SSI Features
- ✅ **Decentralized Identifiers (DIDs)**: Each agent has a unique, cryptographically verifiable identity
- ✅ **Verifiable Credentials**: Issue, hold, and verify tamper-proof credentials
- ✅ **Secure Wallets**: Individual encrypted wallets for each agent
- ✅ **Connection Management**: Establish trust relationships between agents
- ✅ **Schema Validation**: Predefined schemas for healthcare credentials

### Blockchain Features (NEW!)
- ⛓️ **Ethereum Integration**: All DIDs and credentials are anchored on Ethereum blockchain
- 🔒 **Immutable Records**: Credentials recorded on-chain cannot be tampered with
- 🚫 **On-Chain Revocation**: Revoke credentials directly on the blockchain
- 🔍 **Transparent Verification**: Anyone can verify credentials against blockchain
- 💼 **Ethereum Wallets**: Each agent has an Ethereum address for blockchain interactions
- 📊 **Smart Contract Registry**: Custom SSIRegistry contract manages all SSI operations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SSI Agent System                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Hospital   │  │   Patient    │  │   Insurer    │     │
│  │   Agent      │  │   Agent      │  │   Agent      │     │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤     │
│  │ DID (Veramo) │  │ DID (Veramo) │  │ DID (Veramo) │     │
│  │ ETH Wallet   │  │ ETH Wallet   │  │ ETH Wallet   │     │
│  │ Credentials  │  │ Credentials  │  │ Credentials  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │     Ethereum Blockchain (Sepolia)      │
        ├────────────────────────────────────────┤
        │                                        │
        │  ┌──────────────────────────────────┐ │
        │  │     SSIRegistry Smart Contract    │ │
        │  ├──────────────────────────────────┤ │
        │  │ • DID Registry                   │ │
        │  │ • Credential Registry            │ │
        │  │ • Revocation Management          │ │
        │  │ • Verification Functions         │ │
        │  └──────────────────────────────────┘ │
        │                                        │
        └────────────────────────────────────────┘
```

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Ethereum wallet with testnet ETH (for Sepolia deployment)
- Alchemy or Infura account (for RPC access)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd ssi-blockchain-agents

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your settings:

```env
# Get API key from https://www.alchemy.com/
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Generate private key or use existing one (DO NOT SHARE!)
PRIVATE_KEY=your_private_key_here

# Get from https://etherscan.io/myapikey
ETHERSCAN_API_KEY=your_etherscan_api_key

# Choose network: sepolia, localhost, or mainnet
BLOCKCHAIN_NETWORK=sepolia

# Enable blockchain features
USE_BLOCKCHAIN=true
```

### 3. Deploy Smart Contract

#### Option A: Deploy to Sepolia Testnet (Recommended)

```bash
# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia
```

#### Option B: Deploy to Local Hardhat Network

```bash
# Terminal 1: Start local blockchain
npm run node:start

# Terminal 2: Deploy contract
npm run deploy:local
```

### 4. Run the Application

```bash
npm start
```

## 📖 Usage Guide

### Creating Agents

1. Select "➕ Create New Agent"
2. Enter agent name (e.g., "City Hospital")
3. Choose agent type (Hospital, Patient, Insurer)
4. Agent will be created with:
   - Decentralized Identifier (DID)
   - Ethereum wallet address
   - DID registered on blockchain

### Issuing Credentials

1. Select "📄 Issue Credential"
2. Choose issuer (must be connected to subject)
3. Choose subject (credential recipient)
4. Select credential type:
   - **VaccinationRecord**: Vaccine name, date, dose, batch number
   - **MedicalRecord**: Record type, diagnosis, treatment
   - **HealthInsurance**: Policy number, coverage, validity
5. Fill in credential details
6. Credential will be:
   - Cryptographically signed
   - Stored in subject's wallet
   - Anchored on Ethereum blockchain

### Verifying Credentials

1. Select "🔍 Verify Credential"
2. Choose verifier agent
3. Select credential to verify
4. System performs:
   - Cryptographic signature verification
   - Blockchain existence check
   - Revocation status check

### Blockchain Operations

#### Deploy Contract
- Use menu option or CLI command
- Requires ETH for gas fees
- Contract address saved automatically

#### View Blockchain Info
- Check agent's Ethereum address
- View ETH balance
- See blockchain transaction history

#### Revoke Credentials
- Only issuer can revoke
- Creates on-chain revocation record
- Permanently marks credential as invalid

## 🎯 Use Cases

### Healthcare Ecosystem

```
Hospital (Issuer)
    ↓ Issues vaccination record
Patient (Holder)
    ↓ Presents credential
Pharmacy (Verifier)
    ↓ Verifies on blockchain
✅ Approved for medication
```

### Insurance Verification

```
Insurance Company (Issuer)
    ↓ Issues health insurance credential
Patient (Holder)
    ↓ Presents to hospital
Hospital (Verifier)
    ↓ Verifies coverage on blockchain
✅ Treatment approved
```

## 🔐 Security Features

### Cryptographic Security
- **Ed25519 signatures**: All credentials cryptographically signed
- **JWT format**: Industry-standard credential format
- **Encrypted storage**: Private keys encrypted at rest
- **Secure key management**: Hardware security module support

### Blockchain Security
- **Immutable records**: Once on blockchain, cannot be altered
- **Transparent verification**: Public verification without exposing data
- **Decentralized trust**: No single point of failure
- **Smart contract auditing**: All operations logged on-chain

## 📁 Project Structure

```
ssi-blockchain-agents/
├── contracts/
│   └── SSIRegistry.sol          # Smart contract for SSI operations
├── scripts/
│   └── deploy.js                # Contract deployment script
├── data/
│   ├── wallets/                 # Agent wallets (encrypted)
│   │   └── [agent-id]/
│   │       ├── agent.db         # Veramo database
│   │       ├── credentials/     # Stored credentials
│   │       ├── connections/     # Trust connections
│   │       ├── blockchain/      # Blockchain info
│   │       └── ethereum-wallet.json  # Encrypted ETH wallet
│   ├── registry.json            # Agent registry
│   └── blockchain-config.json   # Contract addresses
├── agentConfig-blockchain.js    # Agent configuration with blockchain
├── agentManager-blockchain.js   # Agent manager with blockchain ops
├── blockchainConfig.js          # Blockchain integration layer
├── index.js                     # Main application (CLI)
├── hardhat.config.js            # Hardhat configuration
├── package.json                 # Dependencies
└── .env                         # Environment variables (create from .env.example)
```

## 🔧 Smart Contract API

### SSIRegistry Contract

#### Register DID
```solidity
function registerDID(string memory did) public returns (bool)
```

#### Issue Credential
```solidity
function issueCredential(
    bytes32 credentialHash,
    string memory issuerDID,
    string memory subjectDID,
    string memory credentialType
) public returns (bool)
```

#### Verify Credential
```solidity
function verifyCredential(bytes32 credentialHash) 
    public view returns (
        bool exists,
        uint256 issuedAt,
        string memory issuerDID,
        string memory subjectDID,
        string memory credentialType,
        bool revoked
    )
```

#### Revoke Credential
```solidity
function revokeCredential(bytes32 credentialHash) public returns (bool)
```

## 🧪 Testing

```bash
# Run smart contract tests
npm test

# Run with coverage
npx hardhat coverage

# Run with gas reporting
REPORT_GAS=true npm test
```

## 📊 Gas Costs (Estimated)

| Operation | Gas Cost | USD (at $2000 ETH, 30 gwei) |
|-----------|----------|------------------------------|
| Deploy Contract | ~1,500,000 | ~$90 |
| Register DID | ~80,000 | ~$4.80 |
| Issue Credential | ~120,000 | ~$7.20 |
| Revoke Credential | ~50,000 | ~$3.00 |
| Verify Credential | 0 (read-only) | $0.00 |

## 🌐 Supported Networks

- **Sepolia Testnet** (Recommended for testing)
- **Ethereum Mainnet** (Production - use with caution!)
- **Hardhat Local** (Development)

## 🔍 Verifying Contracts on Etherscan

After deployment:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### "Insufficient funds for gas"
- Ensure your wallet has enough Sepolia ETH
- Get testnet ETH from: https://sepoliafaucet.com/

### "Contract not deployed"
- Run deployment script first: `npm run deploy:sepolia`
- Check blockchain-config.json for contract address

### "Cannot connect to network"
- Verify RPC URL in .env
- Check Alchemy/Infura API key is valid
- Ensure internet connection is stable

### "Private key error"
- Ensure PRIVATE_KEY in .env has no '0x' prefix
- Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 📚 Additional Resources

- [Veramo Documentation](https://veramo.io/)
- [Ethereum Documentation](https://ethereum.org/developers)
- [Hardhat Documentation](https://hardhat.org/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [DID Specification](https://www.w3.org/TR/did-core/)

## 🎓 Learn More

- [Self-Sovereign Identity Principles](https://sovrin.org/principles-of-ssi/)
- [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/)
- [Verifiable Credentials Use Cases](https://www.w3.org/TR/vc-use-cases/)
- [Ethereum Smart Contracts](https://ethereum.org/en/developers/docs/smart-contracts/)

## 💡 Future Enhancements

- [ ] zkSNARKs for privacy-preserving verification
- [ ] IPFS integration for credential storage
- [ ] Multi-signature credential issuance
- [ ] Credential delegation and proxy
- [ ] Mobile app integration
- [ ] Web interface
- [ ] Layer 2 scaling solutions (Polygon, Arbitrum)
- [ ] Cross-chain credential verification

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

---

**Built with ❤️ using Veramo, Ethereum, and Hardhat**
