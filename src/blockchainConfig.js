import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Blockchain Configuration
 * Manages Ethereum connections and smart contract interactions
 * MATCHES DEPLOYED SSIRegistry.sol CONTRACT
 */

export class BlockchainManager {
  constructor(network = 'sepolia') {
    this.network = network;
    this.provider = null;
    this.contract = null;
    this.contractAddress = null;
    this.configPath = './data/blockchain-config.json';
  }

  /**
   * Initialize blockchain connection
   */
  async initialize() {
    const networks = {
      sepolia: {
        name: 'Sepolia Testnet',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
        chainId: 11155111,
        explorer: 'https://sepolia.etherscan.io'
      },
      localhost: {
        name: 'Local Hardhat',
        rpcUrl: 'http://127.0.0.1:8545',
        chainId: 31337,
        explorer: null
      }
    };

    const networkConfig = networks[this.network] || networks.sepolia;
    
    try {
      // Create provider - simpler approach without network detection override
      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      
      // Quick connection test with longer timeout
      try {
        const blockNumber = await Promise.race([
          this.provider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        console.log(`✅ Connected to ${networkConfig.name} - Block: ${blockNumber}`);
      } catch (err) {
        console.log(`⚠️  Could not verify connection: ${err.message}`);
        // Continue anyway - provider might still work
      }
      
      // Load contract config
      const config = await this.loadConfig();
      if (config.contractAddress) {
        this.contractAddress = config.contractAddress;
        try {
          await this.connectToExistingContract(config.contractAddress);
          console.log(`📜 Using contract at: ${config.contractAddress}`);
          
          // Verify contract is accessible
          try {
            const count = await this.contract.getCredentialCount();
            console.log(`✅ Contract connected - ${count} credentials on chain\n`);
          } catch (err) {
            console.log(`⚠️  Contract read test failed: ${err.message}\n`);
            // Contract object exists but might have issues
          }
        } catch (err) {
          console.log(`⚠️  Contract connection failed: ${err.message}\n`);
          this.contract = null; // Clear invalid contract
        }
      } else {
        console.log(`⚠️  No contract address configured\n`);
      }
      
      return {
        network: networkConfig.name,
        chainId: networkConfig.chainId,
        explorer: networkConfig.explorer
      };
    } catch (error) {
      console.log(`⚠️  Blockchain init failed: ${error.message}\n`);
      return { network: networkConfig.name, offline: true };
    }
  }

  /**
   * Connect to deployed contract
   */
  async connectToExistingContract(address) {
    // ABI matching your deployed SSIRegistry.sol
    const abi = [
      "event DIDRegistered(string indexed did, address indexed owner, uint256 timestamp)",
      "event CredentialIssued(bytes32 indexed credentialHash, string issuerDID, string subjectDID, string credentialType, uint256 timestamp)",
      "event CredentialRevoked(bytes32 indexed credentialHash, uint256 timestamp)",
      "function registerDID(string memory did) public returns (bool)",
      "function issueCredential(bytes32 credentialHash, string memory issuerDID, string memory subjectDID, string memory credentialType) public returns (bool)",
      "function revokeCredential(bytes32 credentialHash) public returns (bool)",
      "function verifyCredential(bytes32 credentialHash) public view returns (bool, uint256, string memory, string memory, string memory, bool)",
      "function getDIDInfo(string memory did) public view returns (bool, address, uint256)",
      "function getDIDsByOwner(address owner) public view returns (string[] memory)",
      "function getCredentialCount() public view returns (uint256)",
      "function isRevoked(bytes32 credentialHash) public view returns (bool, uint256)",
      "function getCredential(bytes32 credentialHash) public view returns (uint256, string memory, string memory, string memory, bool, uint256)"
    ];

    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      this.contractAddress = address;
      this.contract = new ethers.Contract(address, abi, this.provider);
      
      // Verify it's a valid contract by checking code at address
      const code = await this.provider.getCode(address);
      if (code === '0x') {
        throw new Error('No contract deployed at this address');
      }
    } catch (error) {
      console.log(`⚠️  Contract setup issue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create wallet for an agent
   */
  async getOrCreateWallet(agentId, privateKey = null) {
    const walletPath = `./data/wallets/${agentId}/keys/ethereum-wallet.json`;
    
    try {
      const walletData = await fs.readFile(walletPath, 'utf-8');
      const parsed = JSON.parse(walletData);
      
      // Create wallet from stored private key
      let wallet = new ethers.Wallet(parsed.privateKey);
      
      if (this.provider) {
        wallet = wallet.connect(this.provider);
      }
      
      return wallet;
    } catch {
      // Create new wallet
      let wallet = privateKey ? new ethers.Wallet(privateKey) : ethers.Wallet.createRandom();
      
      if (this.provider) {
        wallet = wallet.connect(this.provider);
      }
      
      // Save wallet data (NOT encrypted for demo - encrypt in production!)
      await fs.mkdir(path.dirname(walletPath), { recursive: true });
      await fs.writeFile(walletPath, JSON.stringify({
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase || null,
        createdAt: new Date().toISOString()
      }, null, 2), { mode: 0o600 });
      
      console.log(`  Created wallet: ${wallet.address}`);
      return wallet;
    }
  }

  /**
   * Register DID on blockchain
   */
  async registerDID(did, wallet) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    if (!wallet || !wallet.provider) {
      throw new Error('Wallet not connected to provider');
    }

    try {
      // Check if DID already registered
      const didInfo = await this.contract.getDIDInfo(did);
      if (didInfo[0]) {
        console.log(`  ℹ️  DID already registered: ${did.substring(0, 30)}...`);
        return {
          success: true,
          alreadyRegistered: true
        };
      }

      // Register the DID
      const contract = this.contract.connect(wallet);
      const tx = await contract.registerDID(did);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        alreadyRegistered: false
      };
    } catch (error) {
      // More detailed error handling
      if (error.message.includes('insufficient funds')) {
        throw new Error(`Insufficient ETH in wallet ${wallet.address}. Fund it at https://sepoliafaucet.com/`);
      }
      throw new Error(`DID registration failed: ${error.message}`);
    }
  }

  /**
   * Issue credential on blockchain
   * CRITICAL FIX: Proper bytes32 generation
   */
  async issueCredentialOnChain(credential, issuerDID, subjectDID, issuerWallet) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    if (!issuerWallet || !issuerWallet.provider) {
      throw new Error('Issuer wallet not connected to provider');
    }

    try {
      // Create a stable string representation of the credential
      // Important: Use deterministic serialization
      const credentialString = JSON.stringify(credential, Object.keys(credential).sort());
      
      // Generate proper bytes32 hash using keccak256
      // This will produce a 32-byte hash (64 hex characters + 0x prefix = 66 total)
      const credentialHashBytes = ethers.keccak256(ethers.toUtf8Bytes(credentialString));
      
      // CRITICAL: Verify it's proper bytes32 format
      if (!credentialHashBytes || credentialHashBytes.length !== 66) {
        throw new Error(`Invalid hash format: ${credentialHashBytes}`);
      }

      // Extract credential type
      let credentialType = 'VerifiableCredential';
      if (Array.isArray(credential.type)) {
        // Find the specific type (not the generic VerifiableCredential)
        credentialType = credential.type.find(t => t !== 'VerifiableCredential') || credential.type[0];
      } else if (typeof credential.type === 'string') {
        credentialType = credential.type;
      }

      // Check if credential already exists
      const existing = await this.contract.verifyCredential(credentialHashBytes);
      if (existing[0]) {
        console.log(`  ℹ️  Credential already on blockchain`);
        return {
          success: true,
          credentialHash: credentialHashBytes,
          alreadyExists: true
        };
      }

      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(issuerWallet);
      
      // Call the contract function - matches SSIRegistry.sol signature exactly
      const tx = await contractWithSigner.issueCredential(
        credentialHashBytes,  // bytes32 credentialHash
        issuerDID,            // string issuerDID
        subjectDID,           // string subjectDID
        credentialType        // string credentialType
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        credentialHash: credentialHashBytes,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        alreadyExists: false
      };
    } catch (error) {
      // Provide detailed error information
      const errorMessage = error.message || error.toString();
      
      // Check for common errors
      if (errorMessage.includes('insufficient funds')) {
        return {
          success: false,
          error: `Insufficient ETH in wallet ${issuerWallet.address}. Fund it at https://sepoliafaucet.com/`
        };
      }
      
      if (errorMessage.includes('Issuer DID not registered')) {
        return {
          success: false,
          error: 'Issuer DID not registered on blockchain. This should have been auto-registered.'
        };
      }
      
      if (errorMessage.includes('Subject DID not registered')) {
        return {
          success: false,
          error: 'Subject DID not registered on blockchain. This should have been auto-registered.'
        };
      }
      
      console.error(`  ⚠️  Blockchain storage failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify credential on blockchain
   */
  async verifyCredentialOnChain(credential) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Create same hash as when issuing
      const credentialString = JSON.stringify(credential, Object.keys(credential).sort());
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(credentialString));

      // Call contract's verifyCredential function
      const result = await this.contract.verifyCredential(credentialHash);
      
      return {
        exists: result[0],
        timestamp: Number(result[1]),
        issuerDID: result[2],
        subjectDID: result[3],
        credentialType: result[4],
        revoked: result[5],
        credentialHash
      };
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Revoke credential on blockchain
   */
  async revokeCredentialOnChain(credential, revokerWallet) {
    if (!this.contract || !revokerWallet) {
      throw new Error('Contract or wallet not initialized');
    }

    try {
      const credentialString = JSON.stringify(credential, Object.keys(credential).sort());
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(credentialString));

      const contract = this.contract.connect(revokerWallet);
      const tx = await contract.revokeCredential(credentialHash);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Revocation failed: ${error.message}`);
    }
  }

  /**
   * Get credential count
   */
  async getCredentialCount() {
    if (!this.contract) return 0;
    try {
      const count = await this.contract.getCredentialCount();
      return Number(count);
    } catch {
      return 0;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address) {
    if (!this.provider) {
      return { wei: '0', ether: '0.0' };
    }
    try {
      const balance = await this.provider.getBalance(address);
      return {
        wei: balance.toString(),
        ether: ethers.formatEther(balance)
      };
    } catch {
      return { wei: '0', ether: '0.0' };
    }
  }

  /**
   * Get blockchain explorer URL
   */
  getExplorerUrl(type, value) {
    const explorers = {
      sepolia: 'https://sepolia.etherscan.io',
      localhost: null
    };

    const baseUrl = explorers[this.network];
    if (!baseUrl) return null;

    switch (type) {
      case 'tx':
        return `${baseUrl}/tx/${value}`;
      case 'address':
        return `${baseUrl}/address/${value}`;
      case 'block':
        return `${baseUrl}/block/${value}`;
      default:
        return baseUrl;
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(config) {
    try {
      const existingConfig = await this.loadConfig();
      const updatedConfig = { ...existingConfig, ...config };
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      console.error('Config save failed:', error.message);
    }
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.contractAddress) {
        this.contractAddress = config.contractAddress;
      }
      return config;
    } catch {
      return {};
    }
  }

  /**
   * Connect to contract (convenience method)
   */
  async connectToContract(address, wallet) {
    await this.connectToExistingContract(address);
    await this.saveConfig({ contractAddress: address });
    return this.contract;
  }

  /**
   * Check if wallet has sufficient balance for transaction
   */
  async checkBalance(wallet, minEther = '0.001') {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const balance = await this.provider.getBalance(wallet.address);
    const minBalance = ethers.parseEther(minEther);
    
    if (balance < minBalance) {
      throw new Error(
        `Insufficient balance. Have: ${ethers.formatEther(balance)} ETH, ` +
        `Need at least: ${minEther} ETH. ` +
        `Please fund ${wallet.address} on Sepolia testnet at https://sepoliafaucet.com/`
      );
    }
    
    return {
      balance: ethers.formatEther(balance),
      sufficient: true
    };
  }

  /**
   * Deploy the SSIRegistry smart contract
   */
  async deployContract(wallet) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    if (!wallet || !wallet.provider) {
      throw new Error('Wallet not connected to provider');
    }

    // SSIRegistry bytecode placeholder - in production, compile SSIRegistry.sol with solc or hardhat
    // For now, use the ABI and a compiled bytecode
    const abi = [
      "event DIDRegistered(string indexed did, address indexed owner, uint256 timestamp)",
      "event CredentialIssued(bytes32 indexed credentialHash, string issuerDID, string subjectDID, string credentialType, uint256 timestamp)",
      "event CredentialRevoked(bytes32 indexed credentialHash, uint256 timestamp)",
      "function registerDID(string memory did) public returns (bool)",
      "function issueCredential(bytes32 credentialHash, string memory issuerDID, string memory subjectDID, string memory credentialType) public returns (bool)",
      "function revokeCredential(bytes32 credentialHash) public returns (bool)",
      "function verifyCredential(bytes32 credentialHash) public view returns (bool, uint256, string memory, string memory, string memory, bool)",
      "function getDIDInfo(string memory did) public view returns (bool, address, uint256)",
      "function getDIDsByOwner(address owner) public view returns (string[] memory)",
      "function getCredentialCount() public view returns (uint256)",
      "function isRevoked(bytes32 credentialHash) public view returns (bool, uint256)",
      "function getCredential(bytes32 credentialHash) public view returns (uint256, string memory, string memory, string memory, bool, uint256)"
    ];

    try {
      // Check balance first
      const balance = await this.provider.getBalance(wallet.address);
      if (balance === 0n) {
        throw new Error(
          `No ETH in deployer wallet ${wallet.address}. ` +
          `Fund it at https://sepoliafaucet.com/ before deploying.`
        );
      }

      // NOTE: You must compile SSIRegistry.sol to get the bytecode.
      // Use: npx hardhat compile, or solc --bin contracts/SSIRegistry.sol
      // Then paste the bytecode hex string below.
      throw new Error(
        'Contract bytecode not embedded. To deploy:\n' +
        '  1. Install hardhat: npm install --save-dev hardhat\n' +
        '  2. Run: npx hardhat compile\n' +
        '  3. Use the compiled bytecode, or deploy via:\n' +
        '     npx hardhat run scripts/deploy.js --network sepolia\n' +
        '  4. Then use "Connect to Contract" with the deployed address.'
      );
    } catch (error) {
      throw error;
    }
  }

  formatEther(wei) {
    return ethers.formatEther(wei);
  }

  parseEther(ether) {
    return ethers.parseEther(ether);
  }
}

export default BlockchainManager;