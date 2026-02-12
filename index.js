import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { AGENT_TYPES, CREDENTIAL_SCHEMAS } from './src/agentConfig-blockchain.js';
import { AgentManager } from './src/agentManager-blockchain.js';

const agentManager = new AgentManager(true, process.env.BLOCKCHAIN_NETWORK || 'sepolia');

// Display enhanced banner
function displayBanner() {
  console.clear();
  console.log(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   SSI HEALTHCARE - BLOCKCHAIN ENABLED BILLING SYSTEM ⛓️  ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝'));
  console.log('');
}

// Display statistics
function displayStats() {
  const stats = agentManager.getStatistics();
  
  if (stats.totalAgents === 0) return;

  console.log(chalk.gray('┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.gray('│ ') + chalk.white.bold('System Statistics') + chalk.gray('                               │'));
  console.log(chalk.gray('├─────────────────────────────────────────────────────┤'));
  console.log(chalk.gray('│ ') + chalk.cyan('Agents:        ') + chalk.white(stats.totalAgents.toString().padEnd(35)) + chalk.gray('│'));
  console.log(chalk.gray('│ ') + chalk.cyan('Connections:   ') + chalk.white(stats.totalConnections.toString().padEnd(35)) + chalk.gray('│'));
  console.log(chalk.gray('│ ') + chalk.cyan('Credentials:   ') + chalk.white(stats.totalCredentials.toString().padEnd(35)) + chalk.gray('│'));
  console.log(chalk.gray('│ ') + chalk.cyan('Blockchain:    ') + chalk.white(stats.blockchainNetwork.padEnd(35)) + chalk.gray('│'));
  console.log(chalk.gray('└─────────────────────────────────────────────────────┘'));
  console.log('');
}

// Main menu
async function mainMenu() {
  const choices = [
    new inquirer.Separator(chalk.cyan('═══ AGENT MANAGEMENT ═══')),
    { name: '➕  Create New Agent', value: 'create' },
    { name: '📋  List All Agents', value: 'list' },
    { name: '👁️   View Agent Details', value: 'view' },
    { name: '📊  View Statistics', value: 'stats' },
    { name: '🗑️   Delete Agent', value: 'delete' },
    
    new inquirer.Separator(chalk.cyan('═══ CONNECTIONS ═══')),
    { name: '🔗  Connect Two Agents', value: 'connect' },
    { name: '✂️   Disconnect Agents', value: 'disconnect' },
    
    new inquirer.Separator(chalk.cyan('═══ CREDENTIALS & BILLING ═══')),
    { name: '🏥  Hospital Issues Bill', value: 'issue-bill' },
    { name: '💳  Insurance Verifies & Pays', value: 'verify-pay' },
    { name: '📄  Issue Custom Credential', value: 'issue' },
    { name: '🔍  Verify Credential', value: 'verify' },
    { name: '🚫  Revoke Credential', value: 'revoke' },
    { name: '📤  Export Agent Wallet', value: 'export' },
    
    new inquirer.Separator(chalk.cyan('═══ BLOCKCHAIN ═══')),
    { name: '⛓️  Deploy Smart Contract', value: 'deploy-contract' },
    { name: '🔗  Connect to Contract', value: 'connect-contract' },
    { name: '💰  Check Balances', value: 'balances' },
    { name: '📊  Blockchain Info', value: 'blockchain-info' },
    
    new inquirer.Separator(chalk.cyan('═══ SYSTEM ═══')),
    { name: '🚀  Healthcare Demo', value: 'demo' },
    { name: '🧹  Clean All Data', value: 'clean' },
    { name: '🚪  Exit', value: 'exit' }
  ];

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.bold('What would you like to do?'),
      choices: choices,
      pageSize: 25
    }
  ]);

  return answer.action;
}

// Create new agent
async function createAgent() {
  console.log(chalk.yellow.bold('\n➕ Create New Agent\n'));

  const typeChoices = Object.entries(AGENT_TYPES).map(([key, config]) => ({
    name: `${config.icon}  ${config.label.padEnd(20)} - ${config.description}`,
    value: key,
    short: config.label
  }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter agent name:',
      validate: (input) => {
        if (!input.trim()) return 'Name cannot be empty';
        if (input.length < 3) return 'Name must be at least 3 characters';
        return true;
      }
    },
    {
      type: 'list',
      name: 'type',
      message: 'Select agent type:',
      choices: typeChoices,
      pageSize: 10
    },
    {
      type: 'input',
      name: 'description',
      message: 'Enter description (optional):',
      default: ''
    }
  ]);

  const metadata = {
    description: answers.description
  };

  try {
    const agent = await agentManager.createAgent(answers.name, answers.type, metadata);
    console.log(chalk.green('\n✅ Agent created successfully!'));
    console.log(chalk.cyan(`DID: ${agent.did}`));
    console.log(chalk.cyan(`Blockchain Address: ${agent.blockchainAddress || 'N/A'}\n`));
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// List all agents
function listAgents() {
  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents found. Create one first!\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n📋 All Agents\n'));

  const table = new Table({
    head: [
      chalk.white.bold('Name'),
      chalk.white.bold('Type'),
      chalk.white.bold('DID'),
      chalk.white.bold('Connections'),
      chalk.white.bold('Credentials')
    ],
    colWidths: [25, 20, 45, 13, 13]
  });

  for (const agent of agents) {
    const agentType = AGENT_TYPES[agent.type];
    const typeDisplay = agentType ? `${agentType.icon} ${agentType.label}` : agent.type;
    
    table.push([
      chalk.cyan(agent.name),
      typeDisplay,
      chalk.gray(agent.did.substring(0, 40) + '...'),
      chalk.green(agent.connections?.length || 0),
      chalk.blue(agent.credentials?.length || 0)
    ]);
  }

  console.log(table.toString());
  console.log('');
}

// View agent details
async function viewAgentDetails() {
  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents found\n'));
    return;
  }

  const agentChoices = agents.map(a => {
    const agentType = AGENT_TYPES[a.type];
    const icon = agentType ? agentType.icon : '📦';
    return {
      name: `${icon}  ${a.name} (${a.type})`,
      value: a.id
    };
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Select agent to view:',
      choices: agentChoices,
      pageSize: 10
    }
  ]);

  const agent = agentManager.getAgent(answer.agent);
  const agentType = AGENT_TYPES[agent.type];

  console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold(`║  ${agentType?.icon || '📦'}  ${agent.name.toUpperCase().padEnd(53)}║`));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white.bold('Type:        ') + `${agentType?.icon || '📦'} ${agentType?.label || agent.type}`);
  console.log(chalk.white.bold('Agent ID:    ') + chalk.gray(agent.id));
  console.log(chalk.white.bold('DID:         ') + chalk.gray(agent.did));
  console.log(chalk.white.bold('Blockchain:  ') + chalk.gray(agent.blockchainAddress || 'N/A'));
  
  if (agent.metadata?.description) {
    console.log(chalk.white.bold('Description: ') + agent.metadata.description);
  }
  
  if (agent.metadata?.createdAt) {
    console.log(chalk.white.bold('Created:     ') + new Date(agent.metadata.createdAt).toLocaleString());
  }
  console.log('');

  if (agent.connections && agent.connections.length > 0) {
    console.log(chalk.yellow.bold('🔗 Connections:'));
    agent.connections.forEach(conn => {
      const connType = AGENT_TYPES[conn.type];
      const icon = connType ? connType.icon : '📦';
      console.log(`  ${icon}  ${conn.name.padEnd(30)} (${conn.type})`);
      console.log(chalk.gray(`      ${conn.did.substring(0, 60)}...`));
    });
    console.log('');
  } else {
    console.log(chalk.gray('No connections\n'));
  }

  if (agent.credentials && agent.credentials.length > 0) {
    console.log(chalk.yellow.bold('📄 Credentials:'));
    agent.credentials.forEach((cred, index) => {
      console.log(`  ${index + 1}. ${chalk.cyan(cred.type)}`);
      console.log(`     Issued by: ${cred.issuer}`);
      console.log(`     Date: ${new Date(cred.issuedAt).toLocaleString()}`);
      console.log(`     Status: ${cred.status === 'revoked' ? chalk.red(cred.status) : chalk.green(cred.status)}`);
    });
    console.log('');
  } else {
    console.log(chalk.gray('No credentials\n'));
  }
}

// Delete agent
async function deleteAgent() {
  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents to delete\n'));
    return;
  }

  const agentChoices = agents.map(a => ({
    name: `${a.name} (${a.type})`,
    value: a.id
  }));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Select agent to delete:',
      choices: agentChoices
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('⚠️  This will permanently delete the agent. Continue?'),
      default: false
    }
  ]);

  if (answers.confirm) {
    try {
      await agentManager.deleteAgent(answers.agent);
      console.log(chalk.green('\n✅ Agent deleted successfully\n'));
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}\n`));
    }
  } else {
    console.log(chalk.gray('Deletion cancelled\n'));
  }
}

// Connect two agents
async function connectAgents() {
  const agents = agentManager.listAgents();

  if (agents.length < 2) {
    console.log(chalk.yellow('\n⚠️  Need at least 2 agents to create a connection\n'));
    return;
  }

  const agentChoices = agents.map(a => {
    const agentType = AGENT_TYPES[a.type];
    const icon = agentType ? agentType.icon : '📦';
    return {
      name: `${icon}  ${a.name.padEnd(25)} (${a.type})`,
      value: a.id,
      short: a.name
    };
  });

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent1',
      message: 'Select first agent:',
      choices: agentChoices,
      pageSize: 10
    },
    {
      type: 'list',
      name: 'agent2',
      message: 'Select second agent:',
      choices: (answers) => agentChoices.filter(c => c.value !== answers.agent1),
      pageSize: 10
    }
  ]);

  try {
    await agentManager.connectAgents(answers.agent1, answers.agent2);
    console.log(chalk.green('\n✅ Agents connected successfully\n'));
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// Disconnect agents
async function disconnectAgents() {
  const agents = agentManager.listAgents();
  const agentsWithConnections = agents.filter(a => a.connections && a.connections.length > 0);

  if (agentsWithConnections.length === 0) {
    console.log(chalk.yellow('\n⚠️  No connected agents found\n'));
    return;
  }

  const answer1 = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentId',
      message: 'Select agent:',
      choices: agentsWithConnections.map(a => ({
        name: `${a.name} (${a.connections.length} connection(s))`,
        value: a.id
      }))
    }
  ]);

  const agent = agentManager.getAgent(answer1.agentId);
  const connectionChoices = agent.connections.map(conn => {
    const otherAgent = agentManager.getAgent(conn.agentId);
    const displayName = otherAgent ? otherAgent.name : conn.name || conn.agentId;
    const displayType = otherAgent ? otherAgent.type : conn.type || 'unknown';
    return {
      name: `${displayName} (${displayType})`,
      value: conn.agentId
    };
  });

  const answer2 = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetId',
      message: 'Select connection to remove:',
      choices: connectionChoices
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Disconnect these agents?',
      default: true
    }
  ]);

  if (answer2.confirm) {
    try {
      await agentManager.disconnectAgents(answer1.agentId, answer2.targetId);
      console.log(chalk.green('\n✅ Agents disconnected successfully\n'));
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}\n`));
    }
  }
}

// Hospital issues bill (main use case)
async function hospitalIssueBill() {
  const agents = agentManager.listAgents();
  const hospitals = agents.filter(a => a.type === 'hospital');
  const patients = agents.filter(a => a.type === 'patient');

  if (hospitals.length === 0 || patients.length === 0) {
    console.log(chalk.yellow('\n⚠️  You need at least one hospital and one patient\n'));
    console.log(chalk.gray('Create them first using the "Create New Agent" option\n'));
    return;
  }

  console.log(chalk.yellow.bold('\n🏥 Hospital Issues Medical Bill\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'hospital',
      message: 'Select hospital:',
      choices: hospitals.map(h => ({
        name: `${AGENT_TYPES.hospital.icon}  ${h.name}`,
        value: h.id
      }))
    },
    {
      type: 'list',
      name: 'patient',
      message: 'Select patient:',
      choices: patients.map(p => ({
        name: `${AGENT_TYPES.patient.icon}  ${p.name}`,
        value: p.id
      }))
    },
    {
      type: 'input',
      name: 'billNumber',
      message: 'Bill Number:',
      default: `BILL-${Date.now()}`
    },
    {
      type: 'input',
      name: 'patientName',
      message: 'Patient Name:',
      validate: input => input.trim() ? true : 'Required'
    },
    {
      type: 'input',
      name: 'diagnosis',
      message: 'Diagnosis:',
      validate: input => input.trim() ? true : 'Required'
    },
    {
      type: 'input',
      name: 'treatment',
      message: 'Treatment Details:',
      validate: input => input.trim() ? true : 'Required'
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Total Amount ($):',
      validate: input => !isNaN(parseFloat(input)) && parseFloat(input) > 0 ? true : 'Enter valid amount'
    },
    {
      type: 'input',
      name: 'date',
      message: 'Service Date (YYYY-MM-DD):',
      default: new Date().toISOString().split('T')[0]
    }
  ]);

  const credentialData = {
    type: 'MedicalBill',
    claims: {
      billNumber: answers.billNumber,
      patientName: answers.patientName,
      diagnosis: answers.diagnosis,
      treatment: answers.treatment,
      amount: `$${parseFloat(answers.amount).toFixed(2)}`,
      date: answers.date,
      issuedDate: new Date().toISOString()
    }
  };

  try {
    const credential = await agentManager.issueCredential(
      answers.hospital,
      answers.patient,
      credentialData
    );

    console.log(chalk.green('\n✅ Medical bill issued successfully!'));
    console.log(chalk.cyan(`Bill Number: ${answers.billNumber}`));
    console.log(chalk.cyan(`Amount: $${parseFloat(answers.amount).toFixed(2)}`));
    console.log(chalk.gray('Bill stored on blockchain and in patient wallet\n'));

    // Ask if they want to process insurance now
    const processNow = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'process',
        message: 'Would you like to process insurance verification now?',
        default: true
      }
    ]);

    if (processNow.process) {
      await insuranceVerifyAndPay();
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error issuing bill: ${error.message}\n`));
  }
}

// Insurance verifies and pays
async function insuranceVerifyAndPay() {
  const agents = agentManager.listAgents();
  const insurers = agents.filter(a => a.type === 'insurer');
  const patientsWithBills = agents.filter(a => 
    a.type === 'patient' && 
    a.credentials && 
    a.credentials.some(c => c.type === 'MedicalBill')
  );

  if (insurers.length === 0) {
    console.log(chalk.yellow('\n⚠️  No insurance companies found\n'));
    console.log(chalk.gray('Create an insurer agent first\n'));
    return;
  }

  if (patientsWithBills.length === 0) {
    console.log(chalk.yellow('\n⚠️  No patients with medical bills found\n'));
    console.log(chalk.gray('Issue a medical bill first\n'));
    return;
  }

  console.log(chalk.yellow.bold('\n💳 Insurance Verifies & Processes Payment\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'insurer',
      message: 'Select insurance company:',
      choices: insurers.map(i => ({
        name: `${AGENT_TYPES.insurer.icon}  ${i.name}`,
        value: i.id
      }))
    },
    {
      type: 'list',
      name: 'patient',
      message: 'Select patient:',
      choices: patientsWithBills.map(p => ({
        name: `${AGENT_TYPES.patient.icon}  ${p.name} (${p.credentials.filter(c => c.type === 'MedicalBill').length} bill(s))`,
        value: p.id
      }))
    }
  ]);

  const patient = agentManager.getAgent(answers.patient);
  const bills = patient.credentials.filter(c => c.type === 'MedicalBill' && c.status === 'active');

  if (bills.length === 0) {
    console.log(chalk.yellow('\n⚠️  No active bills found for this patient\n'));
    return;
  }

  const billAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'billIndex',
      message: 'Select bill to verify:',
      choices: bills.map((bill, idx) => {
        const claims = bill.credential.credentialSubject;
        return {
          name: `Bill ${claims.billNumber} - ${claims.amount} - ${claims.diagnosis}`,
          value: patient.credentials.indexOf(bill)
        };
      })
    }
  ]);

  const selectedBill = patient.credentials[billAnswer.billIndex];

  // Verify the credential
  console.log(chalk.cyan('\n🔍 Verifying medical bill credential...\n'));
  
  try {
    const isValid = await agentManager.verifyCredential(answers.insurer, selectedBill.credential);

    if (isValid) {
      console.log(chalk.green('✅ Bill verified successfully!\n'));

      // Get payment details
      const paymentAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'claimNumber',
          message: 'Insurance Claim Number:',
          default: `CLM-${Date.now()}`
        },
        {
          type: 'input',
          name: 'approvedAmount',
          message: 'Approved Amount ($):',
          validate: input => !isNaN(parseFloat(input)) && parseFloat(input) > 0 ? true : 'Enter valid amount'
        },
        {
          type: 'input',
          name: 'coverage',
          message: 'Coverage Percentage:',
          default: '80',
          validate: input => !isNaN(parseInt(input)) && parseInt(input) >= 0 && parseInt(input) <= 100 ? true : 'Enter 0-100'
        }
      ]);

      // Issue insurance payment credential
      const paymentData = {
        type: 'InsurancePayment',
        claims: {
          claimNumber: paymentAnswers.claimNumber,
          originalBillNumber: selectedBill.credential.credentialSubject.billNumber,
          approvedAmount: `$${parseFloat(paymentAnswers.approvedAmount).toFixed(2)}`,
          coverage: `${paymentAnswers.coverage}%`,
          patientName: selectedBill.credential.credentialSubject.patientName,
          paymentDate: new Date().toISOString(),
          status: 'Approved'
        }
      };

      const paymentCredential = await agentManager.issueCredential(
        answers.insurer,
        answers.patient,
        paymentData
      );

      console.log(chalk.green('\n✅ Insurance payment processed successfully!'));
      console.log(chalk.cyan(`Claim Number: ${paymentAnswers.claimNumber}`));
      console.log(chalk.cyan(`Approved Amount: $${parseFloat(paymentAnswers.approvedAmount).toFixed(2)}`));
      console.log(chalk.gray('Payment credential stored on blockchain\n'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// Issue custom credential
async function issueCredential() {
  const agents = agentManager.listAgents();

  if (agents.length < 2) {
    console.log(chalk.yellow('\n⚠️  Need at least 2 agents to issue credentials\n'));
    return;
  }

  console.log(chalk.yellow.bold('\n📄 Issue Credential\n'));

  const agentChoices = agents.map(a => {
    const agentType = AGENT_TYPES[a.type];
    const icon = agentType ? agentType.icon : '📦';
    return {
      name: `${icon}  ${a.name.padEnd(25)} (${a.type})`,
      value: a.id,
      short: a.name
    };
  });

  const issuerAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'issuer',
      message: 'Select issuer:',
      choices: agentChoices,
      pageSize: 10
    }
  ]);

  const issuer = agentManager.getAgent(issuerAnswer.issuer);
  const issuerConfig = AGENT_TYPES[issuer.type];
  
  let availableSchemas = Object.keys(CREDENTIAL_SCHEMAS);
  
  if (issuerConfig && issuerConfig.canIssue && issuerConfig.canIssue.length > 0) {
    console.log(chalk.cyan(`\n${issuerConfig.icon} ${issuer.name} can issue: ${issuerConfig.canIssue.join(', ')}\n`));
    availableSchemas = issuerConfig.canIssue;
  }

  const credTypeChoices = availableSchemas.map(type => {
    const schema = CREDENTIAL_SCHEMAS[type];
    return {
      name: `${type.padEnd(25)} - ${schema.required?.join(', ') || 'Custom'}`,
      value: type,
      short: type
    };
  });

  const credTypeAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'credentialType',
      message: 'Select credential type:',
      choices: credTypeChoices,
      pageSize: 10
    }
  ]);

  const subjectAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'subject',
      message: 'Select subject (recipient):',
      choices: agentChoices.filter(c => c.value !== issuerAnswer.issuer),
      pageSize: 10
    }
  ]);

  const schema = CREDENTIAL_SCHEMAS[credTypeAnswer.credentialType];
  
  console.log(chalk.cyan(`\n📝 Enter credential details:\n`));
  
  const claimPrompts = [];
  
  for (const [field, config] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(field);
    
    claimPrompts.push({
      type: 'input',
      name: field,
      message: `${isRequired ? '* ' : '  '}${config.description}:`,
      default: config.format === 'date' ? new Date().toISOString().split('T')[0] : undefined,
      validate: (input) => {
        if (isRequired && !input.trim()) {
          return `${field} is required`;
        }
        return true;
      }
    });
  }

  const claims = await inquirer.prompt(claimPrompts);

  Object.keys(claims).forEach(key => {
    if (!claims[key]) delete claims[key];
  });

  const credentialData = {
    type: credTypeAnswer.credentialType,
    claims
  };

  try {
    await agentManager.issueCredential(
      issuerAnswer.issuer,
      subjectAnswer.subject,
      credentialData
    );
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// Verify credential
async function verifyCredential() {
  const agents = agentManager.listAgents();
  const agentsWithCredentials = agents.filter(a => a.credentials && a.credentials.length > 0);

  if (agentsWithCredentials.length === 0) {
    console.log(chalk.yellow('\n⚠️  No credentials found\n'));
    return;
  }

  if (agents.length < 2) {
    console.log(chalk.yellow('\n⚠️  Need at least 2 agents (one holder, one verifier)\n'));
    return;
  }

  console.log(chalk.yellow.bold('\n🔍 Verify Credential\n'));

  const holderAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'holder',
      message: 'Select credential holder:',
      choices: agentsWithCredentials.map(a => ({
        name: `${a.name.padEnd(25)} (${a.credentials.length} credential(s))`,
        value: a.id
      }))
    }
  ]);

  const holder = agentManager.getAgent(holderAnswer.holder);
  
  const credAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'credentialIndex',
      message: 'Select credential to verify:',
      choices: holder.credentials.map((cred, index) => {
        const date = new Date(cred.issuedAt).toLocaleDateString();
        const status = cred.status === 'revoked' ? chalk.red('[REVOKED]') : '';
        return {
          name: `${cred.type.padEnd(25)} - ${cred.issuer} ${status}`,
          value: index
        };
      })
    }
  ]);

  // Let user pick who is verifying (should be different from holder)
  const verifierChoices = agents
    .filter(a => a.id !== holderAnswer.holder)
    .map(a => {
      const agentType = AGENT_TYPES[a.type];
      const icon = agentType ? agentType.icon : '📦';
      return {
        name: `${icon}  ${a.name.padEnd(25)} (${a.type})`,
        value: a.id,
        short: a.name
      };
    });

  const verifierAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'verifier',
      message: 'Select verifier:',
      choices: verifierChoices,
      pageSize: 10
    }
  ]);

  try {
    const credential = holder.credentials[credAnswer.credentialIndex].credential;
    await agentManager.verifyCredential(verifierAnswer.verifier, credential);
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// Revoke credential
async function revokeCredential() {
  const agents = agentManager.listAgents();
  const agentsWithCreds = agents.filter(a => a.credentials && a.credentials.length > 0);

  if (agentsWithCreds.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents with credentials found\n'));
    return;
  }

  const agentAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentId',
      message: 'Select agent whose credential to revoke:',
      choices: agentsWithCreds.map(a => ({
        name: `${a.name} (${a.credentials.length} credential(s))`,
        value: a.id
      }))
    }
  ]);

  const selectedAgent = agentManager.getAgent(agentAnswer.agentId);

  const credChoices = selectedAgent.credentials.map((cred, idx) => ({
    name: `${cred.type} - Issued by ${cred.issuer} on ${new Date(cred.issuedAt).toLocaleDateString()}`,
    value: idx
  }));

  const credAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'credIndex',
      message: 'Select credential to revoke:',
      choices: credChoices
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('⚠️  This will permanently revoke the credential. Continue?'),
      default: false
    }
  ]);

  if (credAnswer.confirm) {
    try {
      const credential = selectedAgent.credentials[credAnswer.credIndex];
      const issuers = agents.filter(a => a.did === credential.issuerDid);
      
      if (issuers.length === 0) {
        console.log(chalk.red('\n❌ Issuer agent not found\n'));
        return;
      }

      await agentManager.revokeCredential(issuers[0].id, credential.credential);
      credential.status = 'revoked';
      credential.revokedAt = Date.now();
      
      // Persist revocation status to wallet file
      await agentManager.saveToWallet(
        agentAnswer.agentId,
        'credentials',
        credential,
        `${credential.id}.json`
      );
      
      console.log(chalk.green('✅ Credential revoked successfully\n'));
    } catch (error) {
      console.log(chalk.red(`❌ Revocation failed: ${error.message}\n`));
    }
  }
}

// Export agent wallet
async function exportAgentWallet() {
  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents found\n'));
    return;
  }

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Select agent to export:',
      choices: agents.map(a => ({
        name: `${a.name} (${a.type})`,
        value: a.id
      }))
    }
  ]);

  try {
    const exportData = await agentManager.exportAgentWallet(answer.agent);
    const agent = agentManager.getAgent(answer.agent);
    const filename = `./data/exports/${agent.name.toLowerCase().replace(/\s+/g, '-')}-wallet-export.json`;
    
    await fs.mkdir('./data/exports', { recursive: true });
    await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
    
    console.log(chalk.green(`\n✅ Wallet exported to: ${filename}\n`));
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// Deploy contract
async function deployContract() {
  console.log(chalk.yellow.bold('\n⛓️  Deploy Smart Contract\n'));

  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('⚠️  Create an agent first to use as deployer\n'));
    return;
  }

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'deployer',
      message: 'Select deployer agent:',
      choices: agents.map(a => ({
        name: `${a.name} (${a.blockchainAddress || 'No wallet'})`,
        value: a.id
      }))
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Deploy contract to blockchain? This may cost gas.',
      default: true
    }
  ]);

  if (answer.confirm) {
    try {
      const result = await agentManager.deployContract(answer.deployer);
      console.log(chalk.green(`\n✅ Contract deployed at: ${result.address}\n`));
    } catch (error) {
      console.log(chalk.red(`❌ Deployment failed: ${error.message}\n`));
    }
  }
}

// Connect to existing contract
async function connectToContract() {
  console.log(chalk.yellow.bold('\n🔗 Connect to Existing Contract\n'));

  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter contract address:',
      validate: (input) => input.startsWith('0x') && input.length === 42 ? true : 'Invalid address'
    }
  ]);

  try {
    const agents = agentManager.listAgents();
    if (agents.length > 0) {
      await agentManager.connectToContract(answer.address, agents[0].id);
      console.log(chalk.green('\n✅ Connected to contract\n'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Connection failed: ${error.message}\n`));
  }
}

// Check balances
async function checkBalances() {
  const agents = agentManager.listAgents();

  if (agents.length === 0) {
    console.log(chalk.yellow('\n⚠️  No agents found\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n💰 Agent Balances\n'));

  const table = new Table({
    head: [
      chalk.white.bold('Agent'),
      chalk.white.bold('Ethereum Address'),
      chalk.white.bold('Balance (ETH)')
    ],
    colWidths: [25, 45, 20]
  });

  for (const agent of agents) {
    if (agent.blockchainAddress) {
      try {
        const balance = await agentManager.getBlockchainBalance(agent.id);
        table.push([
          chalk.cyan(agent.name),
          chalk.gray(agent.blockchainAddress),
          chalk.green(balance.ether)
        ]);
      } catch (error) {
        table.push([
          chalk.cyan(agent.name),
          chalk.gray(agent.blockchainAddress),
          chalk.red('Error')
        ]);
      }
    }
  }

  console.log(table.toString());
  console.log('');
}

// Show blockchain info
async function showBlockchainInfo() {
  console.log(chalk.cyan.bold('\n📊 Blockchain Information\n'));

  try {
    if (!agentManager.blockchain) {
      console.log(chalk.yellow('⚠️  Blockchain not initialized. Running in offline mode.\n'));
      return;
    }

    const config = await agentManager.blockchain.loadConfig();
    const table = new Table({
      head: [chalk.white.bold('Property'), chalk.white.bold('Value')],
      colWidths: [30, 50]
    });

    table.push(
      ['Network', chalk.cyan(agentManager.network)],
      ['Contract Address', config.contractAddress ? chalk.green(config.contractAddress) : chalk.red('Not deployed')],
      ['Deployed At', config.deployedAt || 'N/A']
    );

    if (agentManager.blockchain.contract) {
      const count = await agentManager.blockchain.getCredentialCount();
      table.push(['Credentials On-Chain', chalk.cyan(count.toString())]);
    }

    console.log(table.toString());
    console.log('');

    if (config.contractAddress) {
      const explorerUrl = agentManager.blockchain.getExplorerUrl('address', config.contractAddress);
      if (explorerUrl) {
        console.log(chalk.gray(`🔍 View on Explorer: ${explorerUrl}\n`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}\n`));
  }
}

// View statistics
function viewStatistics() {
  const stats = agentManager.getStatistics();

  console.log(chalk.cyan.bold('\n📊 System Statistics\n'));

  const table = new Table({
    head: [chalk.white.bold('Metric'), chalk.white.bold('Value')],
    colWidths: [30, 20]
  });

  table.push(
    ['Total Agents', chalk.cyan(stats.totalAgents)],
    ['Total Connections', chalk.green(stats.totalConnections)],
    ['Total Credentials', chalk.blue(stats.totalCredentials)],
    ['Blockchain Network', chalk.yellow(stats.blockchainNetwork)]
  );

  console.log(table.toString());
  console.log('');

  if (Object.keys(stats.agentsByType).length > 0) {
    console.log(chalk.yellow.bold('Agents by Type:\n'));
    
    const typeTable = new Table({
      head: [chalk.white.bold('Type'), chalk.white.bold('Count')],
      colWidths: [30, 20]
    });

    for (const [type, count] of Object.entries(stats.agentsByType)) {
      const agentType = AGENT_TYPES[type];
      const label = agentType ? `${agentType.icon} ${agentType.label}` : type;
      typeTable.push([label, chalk.cyan(count)]);
    }

    console.log(typeTable.toString());
    console.log('');
  }
}

// Healthcare demo
async function healthcareDemo() {
  console.log(chalk.cyan.bold('\n🚀 Healthcare Billing Demo\n'));
  console.log(chalk.white('Creating a complete healthcare billing scenario...\n'));

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Create agents
    console.log(chalk.yellow('Step 1: Creating healthcare ecosystem...'));
    const hospital = await agentManager.createAgent('City General Hospital', 'hospital', {
      description: 'Primary healthcare provider'
    });
    
    const patient = await agentManager.createAgent('John Smith', 'patient', {
      description: 'Patient receiving treatment'
    });
    
    const insurer = await agentManager.createAgent('HealthCare Plus Insurance', 'insurer', {
      description: 'Health insurance provider'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Connect agents
    console.log(chalk.yellow('\nStep 2: Establishing connections...'));
    await agentManager.connectAgents(hospital.id, patient.id);
    await agentManager.connectAgents(patient.id, insurer.id);
    await agentManager.connectAgents(hospital.id, insurer.id);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Issue medical bill
    console.log(chalk.yellow('\nStep 3: Hospital issues medical bill...'));
    const billCred = await agentManager.issueCredential(
      hospital.id,
      patient.id,
      {
        type: 'MedicalBill',
        claims: {
          billNumber: 'BILL-2024-001',
          patientName: 'John Smith',
          diagnosis: 'Appendicitis',
          treatment: 'Appendectomy Surgery',
          amount: '$15,000.00',
          date: '2024-01-15',
          issuedDate: new Date().toISOString()
        }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify bill
    console.log(chalk.yellow('\nStep 4: Verifying medical bill...'));
    await agentManager.verifyCredential(patient.id, billCred);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Issue insurance payment
    console.log(chalk.yellow('\nStep 5: Insurance processes claim...'));
    const paymentCred = await agentManager.issueCredential(
      insurer.id,
      patient.id,
      {
        type: 'InsurancePayment',
        claims: {
          claimNumber: 'CLM-2024-789',
          originalBillNumber: 'BILL-2024-001',
          approvedAmount: '$12,000.00',
          coverage: '80%',
          patientName: 'John Smith',
          paymentDate: new Date().toISOString(),
          status: 'Approved'
        }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(chalk.green.bold('\n✅ Healthcare Demo Completed!\n'));
    console.log(chalk.white('Successfully demonstrated:'));
    console.log(chalk.cyan('  ✓ Created 3 healthcare agents'));
    console.log(chalk.cyan('  ✓ Established trust connections'));
    console.log(chalk.cyan('  ✓ Issued medical bill credential'));
    console.log(chalk.cyan('  ✓ Verified bill on blockchain'));
    console.log(chalk.cyan('  ✓ Processed insurance payment'));
    console.log('');
  } catch (error) {
    console.log(chalk.red(`❌ Demo failed: ${error.message}\n`));
  }
}

// Clean all data
async function cleanData() {
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('⚠️  Delete ALL agents and data? This cannot be undone.'),
      default: false
    }
  ]);

  if (confirm.confirm) {
    const doubleConfirm = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmation',
        message: 'Type "DELETE ALL" to confirm:',
        validate: (input) => input === 'DELETE ALL' ? true : 'Type DELETE ALL'
      }
    ]);

    if (doubleConfirm.confirmation === 'DELETE ALL') {
      try {
        await agentManager.cleanAll();
        console.log(chalk.green('\n✅ All data cleaned\n'));
      } catch (error) {
        console.log(chalk.red(`❌ Error: ${error.message}\n`));
      }
    }
  } else {
    console.log(chalk.gray('Cancelled\n'));
  }
}

// Main application loop
async function main() {
  displayBanner();
  
  // Initialize blockchain
  try {
    await agentManager.initializeBlockchain();
    console.log(chalk.green('✅ Blockchain initialized\n'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Blockchain offline mode\n'));
  }

  // Load existing agents
  const count = await agentManager.loadAgents();
  if (count > 0) {
    console.log(chalk.green(`✅ Loaded ${count} agent${count !== 1 ? 's' : ''}\n`));
  } else {
    console.log(chalk.gray('No existing agents. Create your first agent!\n'));
  }

  displayStats();

  let running = true;

  while (running) {
    const action = await mainMenu();

    try {
      switch (action) {
        case 'create':
          await createAgent();
          break;
        case 'list':
          listAgents();
          break;
        case 'view':
          await viewAgentDetails();
          break;
        case 'stats':
          viewStatistics();
          break;
        case 'delete':
          await deleteAgent();
          break;
        case 'connect':
          await connectAgents();
          break;
        case 'disconnect':
          await disconnectAgents();
          break;
        case 'issue-bill':
          await hospitalIssueBill();
          break;
        case 'verify-pay':
          await insuranceVerifyAndPay();
          break;
        case 'issue':
          await issueCredential();
          break;
        case 'verify':
          await verifyCredential();
          break;
        case 'revoke':
          await revokeCredential();
          break;
        case 'export':
          await exportAgentWallet();
          break;
        case 'deploy-contract':
          await deployContract();
          break;
        case 'connect-contract':
          await connectToContract();
          break;
        case 'balances':
          await checkBalances();
          break;
        case 'blockchain-info':
          await showBlockchainInfo();
          break;
        case 'demo':
          await healthcareDemo();
          break;
        case 'clean':
          await cleanData();
          break;
        case 'exit':
          console.log(chalk.cyan.bold('\n👋 Thank you for using SSI Healthcare System!\n'));
          running = false;
          break;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      console.log('');
    }

    if (running && action !== 'exit') {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: chalk.gray('\nPress Enter to continue...')
        }
      ]);
      displayBanner();
      displayStats();
    }
  }
}

// Error handling
main().catch(error => {
  console.error(chalk.red('\n❌ Fatal Error:'), error);
  console.error(error.stack);
  process.exit(1);
});