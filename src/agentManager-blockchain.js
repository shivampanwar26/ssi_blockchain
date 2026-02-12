import chalk from 'chalk';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';
import {
  AGENT_TYPES,
  canIssueCredential,
  createAgentDatabase,
  createEthereumWallet,
  createVeramoAgent,
  CREDENTIAL_SCHEMAS
} from './agentConfig-blockchain.js';
import { BlockchainManager } from './blockchainConfig.js';

export class AgentManager {
  constructor(enableBlockchain = true, network = 'sepolia') {
    this.agents = new Map();
    this.walletsDir = './data/wallets';
    this.registryFile = './data/registry.json';
    this.enableBlockchain = enableBlockchain;
    this.network = network;
    this.blockchain = null;
  }

  // ======================================================
  // BLOCKCHAIN INITIALIZATION
  // ======================================================
  
  async initializeBlockchain() {
    if (!this.enableBlockchain) return;
    
    try {
      this.blockchain = new BlockchainManager(this.network);
      await this.blockchain.initialize();
      console.log(chalk.green(`✅ Blockchain initialized on ${this.network}\n`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Blockchain unavailable: ${error.message}\n`));
      this.enableBlockchain = false;
    }
  }

  // ======================================================
  // WALLET OPERATIONS
  // ======================================================
  
  async getWalletPath(agentId) {
    return path.join(this.walletsDir, agentId);
  }

  async saveToWallet(agentId, type, data, filename) {
    const walletPath = await this.getWalletPath(agentId);
    const filePath = path.join(walletPath, type, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async loadFromWallet(agentId, type, filename) {
    try {
      const walletPath = await this.getWalletPath(agentId);
      const filePath = path.join(walletPath, type, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async listWalletItems(agentId, type) {
    try {
      const walletPath = await this.getWalletPath(agentId);
      const dirPath = path.join(walletPath, type);
      const files = await fs.readdir(dirPath);
      
      const items = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await this.loadFromWallet(agentId, type, file);
          if (data) items.push(data);
        }
      }
      return items;
    } catch {
      return [];
    }
  }

  // ======================================================
  // REGISTRY OPERATIONS
  // ======================================================
  
  async loadRegistry() {
    try {
      const content = await fs.readFile(this.registryFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  async saveRegistry(registry) {
    await fs.mkdir(path.dirname(this.registryFile), { recursive: true });
    await fs.writeFile(this.registryFile, JSON.stringify(registry, null, 2));
  }

  async updateAgentInRegistry(agentId, updates) {
    const registry = await this.loadRegistry();
    const index = registry.findIndex(a => a.id === agentId);
    
    if (index >= 0) {
      registry[index] = { ...registry[index], ...updates };
      await this.saveRegistry(registry);
    }
  }

  // ======================================================
  // LOAD EXISTING AGENTS
  // ======================================================
  
  async loadAgents() {
    try {
      const registry = await this.loadRegistry();

      for (const data of registry) {
        await this.loadAgent(
          data.id,
          data.name,
          data.type,
          data.did,
          data.metadata,
          data.blockchainAddress
        );
      }

      return this.agents.size;
    } catch (error) {
      console.error('Error loading agents:', error.message);
      return 0;
    }
  }

  async loadAgent(id, name, type, did, metadata = {}, blockchainAddress = null) {
    const db = await createAgentDatabase(id);
    const veramo = await createVeramoAgent(id, db);

    // Load or create Ethereum wallet
    let ethWallet = null;
    let address = blockchainAddress;
    
    if (this.enableBlockchain) {
      try {
        ethWallet = await createEthereumWallet(id);
        address = ethWallet.address;
        
        // Connect wallet to provider if blockchain is available
        if (this.blockchain?.provider) {
          ethWallet = ethWallet.connect(this.blockchain.provider);
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not load blockchain wallet for ${name}`));
      }
    }

    // Load connections from wallet
    const connections = await this.listWalletItems(id, 'connections');
    
    // Load credentials from wallet
    const credentials = await this.listWalletItems(id, 'credentials');

    const agent = {
      id,
      name,
      type,
      did,
      agent: veramo,
      ethWallet,
      blockchainAddress: address,
      connections,
      credentials,
      metadata: {
        ...metadata,
        lastAccessed: new Date().toISOString()
      }
    };

    this.agents.set(id, agent);
    return agent;
  }

  // ======================================================
  // CREATE NEW AGENT
  // ======================================================
  
  async createAgent(name, type, metadata = {}) {
    const id = this.generateAgentId(name);

    if (this.agents.has(id)) {
      throw new Error('Agent already exists');
    }

    const agentType = AGENT_TYPES[type];
    if (!agentType) {
      throw new Error(`Invalid agent type: ${type}`);
    }
    
    console.log(`\n${agentType.icon} Creating agent: ${name}...`);

    const db = await createAgentDatabase(id);
    const veramo = await createVeramoAgent(id, db);

    const identifier = await veramo.didManagerCreate({
      provider: 'did:key',
    });

    // Create Ethereum wallet for blockchain operations
    let ethWallet = null;
    let blockchainAddress = null;
    
    if (this.enableBlockchain) {
      try {
        ethWallet = await createEthereumWallet(id);
        blockchainAddress = ethWallet.address;
        console.log(chalk.gray(`  Blockchain wallet: ${blockchainAddress}`));
        
        // Connect wallet to provider
        if (this.blockchain?.provider) {
          ethWallet = ethWallet.connect(this.blockchain.provider);
        }
        
        // 🔧 FIX #1: Register DID on blockchain immediately
        if (this.blockchain?.contract) {
          try {
            console.log(chalk.gray('  Registering DID on blockchain...'));
            
            // Check wallet balance first
            const balance = await this.blockchain.getBalance(blockchainAddress);
            if (parseFloat(balance.ether) < 0.001) {
              console.log(chalk.yellow(`  ⚠️  Low balance (${balance.ether} ETH). Fund at https://sepoliafaucet.com/`));
              console.log(chalk.yellow(`     Address: ${blockchainAddress}`));
            } else {
              const result = await this.blockchain.registerDID(identifier.did, ethWallet);
              if (result.success) {
                console.log(chalk.green(`  ✅ DID registered (tx: ${result.transactionHash.substring(0, 10)}...)`));
                metadata.didRegistrationTx = result.transactionHash;
                metadata.didRegisteredAt = new Date().toISOString();
              }
            }
          } catch (error) {
            console.log(chalk.yellow(`  ⚠️  DID registration failed: ${error.message}`));
            // Continue anyway - can register later
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Blockchain wallet creation failed: ${error.message}`));
      }
    }

    const agent = {
      id,
      name,
      type,
      did: identifier.did,
      agent: veramo,
      ethWallet,
      blockchainAddress,
      connections: [],
      credentials: [],
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        agentType: agentType.label
      }
    };

    this.agents.set(id, agent);

    // Add to registry
    const registry = await this.loadRegistry();
    registry.push({
      id,
      name,
      type,
      did: identifier.did,
      blockchainAddress,
      metadata: agent.metadata
    });
    await this.saveRegistry(registry);

    console.log(`✅ Created: ${name}`);
    console.log(`DID: ${identifier.did}\n`);

    return agent;
  }

  // ======================================================
  // DELETE AGENT
  // ======================================================
  
  async deleteAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Remove from other agents' connections
    for (const other of this.agents.values()) {
      const updated = other.connections.filter(c => c.agentId !== id);
      if (updated.length !== other.connections.length) {
        other.connections = updated;
        // Update connections in wallet
        for (const conn of other.connections) {
          await this.saveToWallet(other.id, 'connections', conn, `${conn.agentId}.json`);
        }
      }
    }

    // Remove from registry
    const registry = await this.loadRegistry();
    const filtered = registry.filter(a => a.id !== id);
    await this.saveRegistry(filtered);

    // Delete wallet directory
    try {
      const walletPath = await this.getWalletPath(id);
      await fs.rm(walletPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Could not delete wallet for ${id}`);
    }

    this.agents.delete(id);
  }

  // ======================================================
  // CONNECT AGENTS
  // ======================================================
  
  async connectAgents(agentId1, agentId2) {
    const agent1 = this.getAgent(agentId1);
    const agent2 = this.getAgent(agentId2);

    if (!agent1 || !agent2) {
      throw new Error('One or both agents not found');
    }

    if (agent1.id === agent2.id) {
      throw new Error('Cannot connect agent to itself');
    }

    // Check if already connected
    if (agent1.connections.some(c => c.agentId === agent2.id)) {
      throw new Error('Agents already connected');
    }

    // Create bidirectional connections
    const connection1 = {
      agentId: agent2.id,
      did: agent2.did,
      name: agent2.name,
      type: agent2.type,
      connectedAt: new Date().toISOString()
    };

    const connection2 = {
      agentId: agent1.id,
      did: agent1.did,
      name: agent1.name,
      type: agent1.type,
      connectedAt: new Date().toISOString()
    };

    agent1.connections.push(connection1);
    agent2.connections.push(connection2);

    // Save connections to wallet
    await this.saveToWallet(agent1.id, 'connections', connection1, `${agent2.id}.json`);
    await this.saveToWallet(agent2.id, 'connections', connection2, `${agent1.id}.json`);

    const type1 = AGENT_TYPES[agent1.type];
    const type2 = AGENT_TYPES[agent2.type];
    console.log(`\n🔗 Connected: ${type1.icon} ${agent1.name} ↔ ${type2.icon} ${agent2.name}\n`);
  }

  // ======================================================
  // DISCONNECT AGENTS
  // ======================================================
  
  async disconnectAgents(agentId1, agentId2) {
    const agent1 = this.getAgent(agentId1);
    const agent2 = this.getAgent(agentId2);

    if (!agent1 || !agent2) {
      throw new Error('One or both agents not found');
    }

    // Remove connections
    agent1.connections = agent1.connections.filter(c => c.agentId !== agent2.id);
    agent2.connections = agent2.connections.filter(c => c.agentId !== agent1.id);

    // Delete connection files
    try {
      await fs.unlink(path.join(await this.getWalletPath(agent1.id), 'connections', `${agent2.id}.json`));
      await fs.unlink(path.join(await this.getWalletPath(agent2.id), 'connections', `${agent1.id}.json`));
    } catch (error) {
      // Files may not exist
    }

    console.log(`\n✂️  Disconnected: ${agent1.name} ↮ ${agent2.name}\n`);
  }

  // ======================================================
  // ISSUE CREDENTIAL
  // ======================================================
  
  async issueCredential(issuerId, subjectId, credentialData) {
    const issuer = this.getAgent(issuerId);
    const subject = this.getAgent(subjectId);

    if (!issuer || !subject) {
      throw new Error('Issuer or subject not found');
    }

    const credentialType = credentialData.type;
    
    // Validate permission using strict rules
    canIssueCredential(issuer.type, credentialType);

    // Validate schema
    const schema = CREDENTIAL_SCHEMAS[credentialType];
    if (!schema) {
      throw new Error(`Unknown credential type: ${credentialType}`);
    }

    // Validate required fields
    for (const field of schema.required) {
      if (!credentialData.claims[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const issuerType = AGENT_TYPES[issuer.type];
    const subjectType = AGENT_TYPES[subject.type];
    
    console.log(`\n${issuerType.icon} ${chalk.cyan(issuer.name)} → ${subjectType.icon} ${chalk.green(subject.name)}`);
    console.log(chalk.yellow(`Issuing: ${credentialType}`));

    // Create the verifiable credential
    const credential = await issuer.agent.createVerifiableCredential({
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', credentialType],
        issuer: { id: issuer.did },
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: subject.did,
          ...credentialData.claims,
        },
      },
      proofFormat: 'jwt',
    });

    const credentialRecord = {
      id: crypto.randomBytes(32).toString('hex'),     
      issuer: issuer.name,
      issuerDid: issuer.did,
      type: credentialType,
      issuedAt: Date.now(),
      credential,
      status: 'active',
      blockchainTxHash: null
    };

    // 🔧 FIX #3: Verify DIDs are registered before issuing credential
    if (this.enableBlockchain && this.blockchain?.contract) {
      try {
        // Check if issuer DID is registered
        const issuerInfo = await this.blockchain.contract.getDIDInfo(issuer.did);
        if (!issuerInfo[0]) { // exists is the first return value
          console.log(chalk.yellow('  ⚠️  Issuer DID not registered, registering now...'));
          const result = await this.blockchain.registerDID(issuer.did, issuer.ethWallet);
          if (result.success) {
            console.log(chalk.green(`  ✅ Issuer DID registered (tx: ${result.transactionHash.substring(0, 10)}...)`));
          }
        }

        // Check if subject DID is registered
        const subjectInfo = await this.blockchain.contract.getDIDInfo(subject.did);
        if (!subjectInfo[0]) {
          console.log(chalk.yellow('  ⚠️  Subject DID not registered, registering now...'));
          // Get subject's wallet
          let subjectWallet = subject.ethWallet;
          if (!subjectWallet || !subjectWallet.provider) {
            subjectWallet = await this.blockchain.getOrCreateWallet(subject.id);
          }
          const result = await this.blockchain.registerDID(subject.did, subjectWallet);
          if (result.success) {
            console.log(chalk.green(`  ✅ Subject DID registered (tx: ${result.transactionHash.substring(0, 10)}...)`));
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  DID registration check failed: ${error.message}`));
      }
    }

    // Store on blockchain if enabled
    if (this.enableBlockchain && this.blockchain?.contract) {
      try {
        console.log(chalk.gray('  Storing credential on blockchain...'));
        
        // Ensure issuer wallet is connected
        let issuerWallet = issuer.ethWallet;
        if (!issuerWallet || !issuerWallet.provider) {
          issuerWallet = await this.blockchain.getOrCreateWallet(issuerId);
        }
        
        // Use the proper blockchain method from blockchainConfig.js
        const result = await this.blockchain.issueCredentialOnChain(
          credential,
          issuer.did,
          subject.did,
          issuerWallet
        );
        
        if (result.success) {
          credentialRecord.blockchainTxHash = result.transactionHash;
          credentialRecord.blockchainHash = result.credentialHash;
          credentialRecord.blockNumber = result.blockNumber;
          console.log(chalk.green(`  ✅ Blockchain TX: ${result.transactionHash.substring(0, 20)}...`));
          
          // Add explorer link
          const explorerUrl = this.blockchain.getExplorerUrl('tx', result.transactionHash);
          if (explorerUrl) {
            console.log(chalk.gray(`     View: ${explorerUrl}`));
          }
        } else {
          console.log(chalk.yellow(`  ⚠️  Blockchain storage failed: ${result.error}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Blockchain storage error: ${error.message}`));
      }
    }

    subject.credentials.push(credentialRecord);

    // Save credential to wallet
    await this.saveToWallet(
      subject.id,
      'credentials',
      credentialRecord,
      `${credentialRecord.id}.json`
    );

    console.log(chalk.green('✅ Issued and saved to wallet\n'));

    return credential;
  }

  // ======================================================
  // VERIFY CREDENTIAL
  // ======================================================
  
  async verifyCredential(verifierId, credential) {
    const verifier = this.getAgent(verifierId);

    if (!verifier) {
      throw new Error('Verifier not found');
    }

    const verifierType = AGENT_TYPES[verifier.type];
    console.log(`\n${verifierType.icon} ${chalk.cyan(verifier.name)} verifying...`);

    try {
      // Verify with Veramo
      const result = await verifier.agent.verifyCredential({
        credential,
      });

      if (!result.verified) {
        console.log(chalk.red('❌ CRYPTOGRAPHIC VERIFICATION FAILED\n'));
        return false;
      }
      
      console.log(chalk.green('  ✅ Cryptographic signature valid'));

      // 🔧 FIX #2: Verify on blockchain using correct hash method
      if (this.enableBlockchain && this.blockchain?.contract) {
        try {
          const blockchainResult = await this.blockchain.verifyCredentialOnChain(credential);
          
          if (!blockchainResult.exists) {
            console.log(chalk.red('❌ CREDENTIAL NOT FOUND ON BLOCKCHAIN\n'));
            return false;
          }

          if (blockchainResult.revoked) {
            console.log(chalk.red('❌ CREDENTIAL REVOKED ON BLOCKCHAIN\n'));
            console.log(chalk.gray(`   Revoked at: ${new Date(blockchainResult.timestamp * 1000).toLocaleString()}`));
            return false;
          }

          console.log(chalk.green('  ✅ Blockchain verified'));
          console.log(chalk.gray(`     Issued: ${new Date(blockchainResult.timestamp * 1000).toLocaleString()}`));
          console.log(chalk.gray(`     Type: ${blockchainResult.credentialType}`));
          console.log(chalk.gray(`     Hash: ${blockchainResult.credentialHash.substring(0, 20)}...`));
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️  Blockchain verification unavailable: ${error.message}`));
        }
      }

      console.log(chalk.green('✅ VERIFIED\n'));
      return true;
    } catch (e) {
      console.log(chalk.red('❌ ERROR:', e.message));
      return false;
    }
  }

  // ======================================================
  // REVOKE CREDENTIAL
  // ======================================================
  
  async revokeCredential(issuerId, credential) {
    const issuer = this.getAgent(issuerId);
    
    if (!issuer) {
      throw new Error('Issuer not found');
    }

    console.log(chalk.yellow(`\n🚫 ${issuer.name} revoking credential...`));

    // Revoke on blockchain if enabled
    if (this.enableBlockchain && this.blockchain?.contract) {
      try {
        // Ensure wallet is connected
        let issuerWallet = issuer.ethWallet;
        if (!issuerWallet || !issuerWallet.provider) {
          issuerWallet = await this.blockchain.getOrCreateWallet(issuerId);
        }
        
        const result = await this.blockchain.revokeCredentialOnChain(credential, issuerWallet);
        
        if (result.success) {
          console.log(chalk.green('✅ Revoked on blockchain'));
          console.log(chalk.gray(`   TX: ${result.transactionHash.substring(0, 20)}...`));
          return true;
        }
      } catch (error) {
        console.log(chalk.red(`❌ Blockchain revocation failed: ${error.message}\n`));
        return false;
      }
    }

    console.log(chalk.yellow('⚠️  Blockchain not available for revocation\n'));
    return false;
  }

  // ======================================================
  // BLOCKCHAIN OPERATIONS
  // ======================================================
  
  async deployContract(deployerId) {
    if (!this.enableBlockchain) {
      throw new Error('Blockchain not enabled');
    }

    const deployer = this.getAgent(deployerId);
    if (!deployer || !deployer.ethWallet) {
      throw new Error('Deployer wallet not found');
    }

    return await this.blockchain.deployContract(deployer.ethWallet);
  }

  async connectToContract(contractAddress, agentId) {
    if (!this.enableBlockchain) {
      throw new Error('Blockchain not enabled');
    }

    const agent = this.getAgent(agentId);
    if (!agent || !agent.ethWallet) {
      throw new Error('Agent wallet not found');
    }

    await this.blockchain.connectToContract(contractAddress, agent.ethWallet);
    return this.blockchain.contract;
  }

  async getBlockchainBalance(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent || !agent.ethWallet) {
      throw new Error('Agent wallet not found');
    }

    return await this.blockchain.getBalance(agent.blockchainAddress);
  }

  // ======================================================
  // HELPER METHODS
  // ======================================================
  
  generateAgentId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  listAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      did: agent.did,
      blockchainAddress: agent.blockchainAddress,
      connections: agent.connections,
      credentials: agent.credentials,
      metadata: agent.metadata
    }));
  }

  // ======================================================
  // EXPORT AGENT DATA
  // ======================================================
  
  async exportAgentWallet(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error('Agent not found');

    const exportData = {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        did: agent.did,
        blockchainAddress: agent.blockchainAddress,
        metadata: agent.metadata
      },
      connections: await this.listWalletItems(agentId, 'connections'),
      credentials: await this.listWalletItems(agentId, 'credentials'),
      exportedAt: new Date().toISOString()
    };

    return exportData;
  }

  // ======================================================
  // GET STATISTICS
  // ======================================================
  
  getStatistics() {
    const agents = this.listAgents();
    const totalConnections = agents.reduce((sum, a) => sum + a.connections.length, 0);
    const totalCredentials = agents.reduce((sum, a) => sum + a.credentials.length, 0);

    const typeCount = {};
    agents.forEach(a => {
      typeCount[a.type] = (typeCount[a.type] || 0) + 1;
    });

    return {
      totalAgents: agents.length,
      totalConnections: totalConnections / 2,
      totalCredentials,
      agentsByType: typeCount,
      blockchainNetwork: this.network
    };
  }

  // ======================================================
  // CLEAN ALL DATA
  // ======================================================
  
  async cleanAll() {
    const agents = this.listAgents();
    for (const agent of agents) {
      await this.deleteAgent(agent.id);
    }
    this.agents.clear();
  }
}