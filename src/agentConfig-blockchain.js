import { createAgent } from '@veramo/core';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { DataStore, DataStoreORM, DIDStore, Entities, KeyStore, PrivateKeyStore } from '@veramo/data-store';
import { DIDManager } from '@veramo/did-manager';
import { KeyDIDProvider } from '@veramo/did-provider-key';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import crypto from 'crypto';
import { Resolver } from 'did-resolver';
import { ethers } from 'ethers';
import { getResolver as ethrDidResolver } from 'ethr-did-resolver';
import fs from 'fs/promises';
import { getResolver as keyDidResolver } from 'key-did-resolver';
import path from 'path';
import { DataSource } from 'typeorm';
import { getResolver as webDidResolver } from 'web-did-resolver';

// Generate or load master encryption key
async function getMasterKey() {
  const keyPath = './data/.master.key';
  
  try {
    const key = await fs.readFile(keyPath, 'utf-8');
    return key.trim();
  } catch {
    // Generate new master key
    const newKey = crypto.randomBytes(32).toString('hex');
    await fs.mkdir('./data', { recursive: true });
    await fs.writeFile(keyPath, newKey, { mode: 0o600 });
    return newKey;
  }
}

// Create wallet directory structure
async function ensureWalletStructure(agentId) {
  const walletPath = `./data/wallets/${agentId}`;
  await fs.mkdir(`${walletPath}/credentials`, { recursive: true });
  await fs.mkdir(`${walletPath}/connections`, { recursive: true });
  await fs.mkdir(`${walletPath}/keys`, { recursive: true });
  return walletPath;
}

// Create Ethereum wallet for blockchain operations
export async function createEthereumWallet(agentId) {
  const walletPath = `./data/wallets/${agentId}/keys`;
  const walletFile = path.join(walletPath, 'ethereum-wallet.json');
  
  try {
    // Try to load existing wallet
    const walletData = await fs.readFile(walletFile, 'utf-8');
    const parsed = JSON.parse(walletData);
    return new ethers.Wallet(parsed.privateKey);
  } catch {
    // Create new wallet
    const wallet = ethers.Wallet.createRandom();
    await fs.mkdir(walletPath, { recursive: true });
    await fs.writeFile(walletFile, JSON.stringify({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || null,
      createdAt: new Date().toISOString()
    }, null, 2), { mode: 0o600 });
    
    return wallet;
  }
}

// Create database connection for an agent
export async function createAgentDatabase(agentId) {
  const walletPath = await ensureWalletStructure(agentId);
  
  const dbConnection = new DataSource({
    type: 'sqlite',
    database: `${walletPath}/agent.db`,
    synchronize: true,
    logging: false,
    entities: Entities,
  });

  await dbConnection.initialize();
  return dbConnection;
}

// Create a Veramo agent with enhanced security
export async function createVeramoAgent(agentId, dbConnection) {
  const masterKey = await getMasterKey();
  
  const agent = createAgent({
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(
            new PrivateKeyStore(dbConnection, new SecretBox(masterKey))
          ),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: 'did:key',
        providers: {
          'did:key': new KeyDIDProvider({
            defaultKms: 'local',
          }),
        },
      }),
      new DIDResolverPlugin({
        resolver: new Resolver({
          ...keyDidResolver(),
          ...ethrDidResolver({ infuraProjectId: 'mock' }),
          ...webDidResolver(),
        }),
      }),
      new CredentialPlugin(),
      new DataStore(dbConnection),
      new DataStoreORM(dbConnection),
    ],
  });

  return agent;
}

// Credential schema definitions with strict issuer rules
export const CREDENTIAL_SCHEMAS = {
  // ONLY HOSPITALS CAN ISSUE
  VaccinationRecord: {
    type: 'VaccinationRecord',
    issuerRestriction: ['hospital'], // Only hospitals
    required: ['vaccine', 'date', 'dose'],
    properties: {
      vaccine: { type: 'string', description: 'Vaccine name' },
      date: { type: 'string', format: 'date', description: 'Vaccination date' },
      dose: { type: 'string', description: 'Dose number/type' },
      batchNumber: { type: 'string', description: 'Vaccine batch number' },
      administeredBy: { type: 'string', description: 'Healthcare provider' }
    }
  },
  
  // ONLY HOSPITALS CAN ISSUE
  MedicalRecord: {
    type: 'MedicalRecord',
    issuerRestriction: ['hospital'], // Only hospitals
    required: ['recordType', 'date'],
    properties: {
      recordType: { type: 'string', description: 'Type of medical record' },
      date: { type: 'string', format: 'date', description: 'Record date' },
      diagnosis: { type: 'string', description: 'Diagnosis' },
      treatment: { type: 'string', description: 'Treatment provided' },
      doctorName: { type: 'string', description: 'Attending physician' }
    }
  },
  
  // ONLY HOSPITALS CAN ISSUE
  MedicalBill: {
    type: 'MedicalBill',
    issuerRestriction: ['hospital'], // Only hospitals
    required: ['billNumber', 'patientName', 'diagnosis', 'treatment', 'amount', 'date'],
    properties: {
      billNumber: { type: 'string', description: 'Unique bill identifier' },
      patientName: { type: 'string', description: 'Patient full name' },
      diagnosis: { type: 'string', description: 'Medical diagnosis' },
      treatment: { type: 'string', description: 'Treatment provided' },
      amount: { type: 'string', description: 'Total bill amount' },
      date: { type: 'string', format: 'date', description: 'Service date' },
      issuedDate: { type: 'string', format: 'date-time', description: 'Bill issue date' }
    }
  },
  
  // ONLY INSURANCE CAN ISSUE
  HealthInsurance: {
    type: 'HealthInsurance',
    issuerRestriction: ['insurer'], // Only insurance companies
    required: ['policyNumber', 'coverage', 'validUntil'],
    properties: {
      policyNumber: { type: 'string', description: 'Insurance policy number' },
      coverage: { type: 'string', description: 'Coverage amount' },
      validUntil: { type: 'string', format: 'date', description: 'Policy expiration date' },
      planType: { type: 'string', description: 'Type of insurance plan' },
      deductible: { type: 'string', description: 'Policy deductible' }
    }
  },
  
  // ONLY INSURANCE CAN ISSUE
  InsurancePayment: {
    type: 'InsurancePayment',
    issuerRestriction: ['insurer'], // Only insurance companies
    required: ['claimNumber', 'originalBillNumber', 'approvedAmount', 'coverage', 'patientName', 'paymentDate', 'status'],
    properties: {
      claimNumber: { type: 'string', description: 'Insurance claim number' },
      originalBillNumber: { type: 'string', description: 'Reference to original bill' },
      approvedAmount: { type: 'string', description: 'Approved payment amount' },
      coverage: { type: 'string', description: 'Coverage percentage' },
      patientName: { type: 'string', description: 'Patient name' },
      paymentDate: { type: 'string', format: 'date-time', description: 'Payment date' },
      status: { type: 'string', description: 'Payment status (Approved/Denied/Pending)' }
    }
  }
};

// Agent type configurations with strict issuing permissions
export const AGENT_TYPES = {
  hospital: {
    label: 'Hospital',
    color: 'cyan',
    icon: '🏥',
    canIssue: ['VaccinationRecord', 'MedicalRecord', 'MedicalBill'], // ONLY these
    description: 'Healthcare provider - can issue medical records, vaccinations, and bills'
  },
  
  patient: {
    label: 'Patient',
    color: 'green',
    icon: '👤',
    canIssue: [], // Patients CANNOT issue any credentials
    description: 'Individual receiving healthcare services - cannot issue credentials'
  },
  
  insurer: {
    label: 'Insurance Company',
    color: 'blue',
    icon: '🏢',
    canIssue: ['HealthInsurance', 'InsurancePayment'], // ONLY these
    description: 'Insurance provider - can issue insurance policies and payment credentials'
  }
};

// Validate if an agent type can issue a specific credential type
export function canIssueCredential(agentType, credentialType) {
  const schema = CREDENTIAL_SCHEMAS[credentialType];
  
  if (!schema) {
    throw new Error(`Unknown credential type: ${credentialType}`);
  }
  
  if (!schema.issuerRestriction) {
    return true; // No restriction
  }
  
  if (!schema.issuerRestriction.includes(agentType)) {
    const allowedTypes = schema.issuerRestriction.map(t => AGENT_TYPES[t]?.label || t).join(', ');
    throw new Error(
      `❌ PERMISSION DENIED: Only ${allowedTypes} can issue ${credentialType} credentials. ` +
      `${AGENT_TYPES[agentType]?.label || agentType} cannot issue this type.`
    );
  }
  
  return true;
}