import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * ====================================================================
 * ZKP MENU - CLI Menu Items for Zero-Knowledge Proof Operations
 * ====================================================================
 * 
 * This module provides the inquirer menu handlers for ZKP operations.
 * 
 * HOW TO INTEGRATE INTO YOUR EXISTING index.js:
 * 
 *   1. Import this module:
 *      import { addZKPMenuItems, handleZKPAction } from './zkpMenu.js';
 *   
 *   2. Add ZKP choices to your main menu:
 *      const choices = [
 *        ...existingChoices,
 *        new inquirer.Separator('═══ ZERO-KNOWLEDGE PROOFS ═══'),
 *        ...addZKPMenuItems(),
 *      ];
 *   
 *   3. In your action handler switch statement, add:
 *      case 'zkp-generate':
 *      case 'zkp-submit':
 *      case 'zkp-verify':
 *      case 'zkp-list':
 *      case 'zkp-received':
 *      case 'zkp-range':
 *        await handleZKPAction(action, agentManager);
 *        break;
 * ====================================================================
 */

// ======================================================
// MENU ITEMS (add to existing inquirer choices)
// ======================================================

export function addZKPMenuItems() {
  return [
    { name: '🔐  Generate ZK Proof (Patient)', value: 'zkp-generate' },
    { name: '📤  Submit ZK Proof to Verifier', value: 'zkp-submit' },
    { name: '🔍  Verify ZK Proof (Insurer)', value: 'zkp-verify' },
    { name: '📋  List My ZK Proofs', value: 'zkp-list' },
    { name: '📥  List Received Proofs', value: 'zkp-received' },
    { name: '🔢  Generate Range Proof', value: 'zkp-range' },
  ];
}

// ======================================================
// ACTION HANDLER (dispatches to correct function)
// ======================================================

export async function handleZKPAction(action, agentManager) {
  switch (action) {
    case 'zkp-generate':
      await handleGenerateProof(agentManager);
      break;
    case 'zkp-submit':
      await handleSubmitProof(agentManager);
      break;
    case 'zkp-verify':
      await handleVerifyProof(agentManager);
      break;
    case 'zkp-list':
      await handleListProofs(agentManager);
      break;
    case 'zkp-received':
      await handleListReceived(agentManager);
      break;
    case 'zkp-range':
      await handleRangeProof(agentManager);
      break;
  }
}

// ======================================================
// GENERATE ZK PROOF (Patient selects credential + fields)
// ======================================================

async function handleGenerateProof(agentManager) {
  const agents = agentManager.listAgents();
  const patients = agents.filter(a => a.type === 'patient');

  if (patients.length === 0) {
    console.log(chalk.yellow('\n⚠️  No patient agents found. Create a patient first.\n'));
    return;
  }

  // Step 1: Select patient
  const { patientId } = await inquirer.prompt([{
    type: 'list',
    name: 'patientId',
    message: 'Select patient (proof generator):',
    choices: patients.map(p => ({
      name: `${p.name} (${p.credentials.length} credentials)`,
      value: p.id,
    })),
  }]);

  const patient = agentManager.getAgent(patientId);
  
  if (!patient.credentials || patient.credentials.length === 0) {
    console.log(chalk.yellow('\n⚠️  This patient has no credentials. Issue a credential first.\n'));
    return;
  }

  // Step 2: Select credential
  const { credentialId } = await inquirer.prompt([{
    type: 'list',
    name: 'credentialId',
    message: 'Select credential to prove:',
    choices: patient.credentials.map(c => ({
      name: `${c.type} (from ${c.issuer}) - ${new Date(c.issuedAt).toLocaleDateString()}`,
      value: c.id,
    })),
  }]);

  const credRecord = patient.credentials.find(c => c.id === credentialId);
  const claims = credRecord.credential?.credentialSubject || {};
  
  // Get fields (excluding 'id' which is the subject DID)
  const availableFields = Object.keys(claims).filter(k => k !== 'id');

  if (availableFields.length === 0) {
    console.log(chalk.yellow('\n⚠️  No claim fields found in this credential.\n'));
    return;
  }

  // Step 3: Select fields to DISCLOSE (everything else stays hidden)
  const { disclosedFields } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'disclosedFields',
    message: 'Select fields to DISCLOSE (unchecked = hidden via ZKP):',
    choices: availableFields.map(f => ({
      name: `${f}: ${claims[f]}`,
      value: f,
      checked: false, // Default: hide everything
    })),
  }]);

  console.log(chalk.cyan(`\n   Disclosed: ${disclosedFields.join(', ') || 'NONE (full ZKP)'}`));
  console.log(chalk.yellow(`   Hidden:    ${availableFields.filter(f => !disclosedFields.includes(f)).join(', ')}`));

  try {
    await agentManager.generateZKProof(patientId, credentialId, disclosedFields);
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
  }
}

// ======================================================
// SUBMIT PROOF (Patient → Insurer)
// ======================================================

async function handleSubmitProof(agentManager) {
  const agents = agentManager.listAgents();
  const patients = agents.filter(a => a.type === 'patient');

  if (patients.length === 0) {
    console.log(chalk.yellow('\n⚠️  No patient agents found.\n'));
    return;
  }

  // Select patient
  const { patientId } = await inquirer.prompt([{
    type: 'list',
    name: 'patientId',
    message: 'Select patient (proof sender):',
    choices: patients.map(p => ({ name: p.name, value: p.id })),
  }]);

  // List patient's proofs
  const proofs = await agentManager.listZKProofs(patientId);
  
  if (proofs.length === 0) {
    console.log(chalk.yellow('\n⚠️  No ZK proofs found. Generate one first.\n'));
    return;
  }

  // Select proof
  const { proofId } = await inquirer.prompt([{
    type: 'list',
    name: 'proofId',
    message: 'Select proof to submit:',
    choices: proofs.map(p => ({
      name: `${p.publicInputs?.credentialType || p.type || 'Unknown'} - ${p.id.substring(0, 12)}... (${new Date(p.generatedAt).toLocaleString()})`,
      value: p.id,
    })),
  }]);

  // Select verifier (insurers)
  const insurers = agents.filter(a => a.type === 'insurer');
  if (insurers.length === 0) {
    console.log(chalk.yellow('\n⚠️  No insurer agents found.\n'));
    return;
  }

  const { verifierId } = await inquirer.prompt([{
    type: 'list',
    name: 'verifierId',
    message: 'Select verifier (insurer):',
    choices: insurers.map(i => ({ name: i.name, value: i.id })),
  }]);

  try {
    await agentManager.submitZKProof(patientId, verifierId, proofId);
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
  }
}

// ======================================================
// VERIFY PROOF (Insurer)
// ======================================================

async function handleVerifyProof(agentManager) {
  const agents = agentManager.listAgents();
  const insurers = agents.filter(a => a.type === 'insurer');

  if (insurers.length === 0) {
    console.log(chalk.yellow('\n⚠️  No insurer agents found.\n'));
    return;
  }

  // Select insurer
  const { insurerId } = await inquirer.prompt([{
    type: 'list',
    name: 'insurerId',
    message: 'Select insurer (verifier):',
    choices: insurers.map(i => ({ name: i.name, value: i.id })),
  }]);

  // List received proofs
  const received = await agentManager.listReceivedProofs(insurerId);

  if (received.length === 0) {
    console.log(chalk.yellow('\n⚠️  No received proofs. A patient must submit a proof first.\n'));
    return;
  }

  // Select proof to verify
  const { proofId } = await inquirer.prompt([{
    type: 'list',
    name: 'proofId',
    message: 'Select proof to verify:',
    choices: received.map(p => ({
      name: `${p.publicInputs?.credentialType || 'Unknown'} from ${p.submittedBy || 'unknown'} - ${p.verified === null ? '⏳ Pending' : p.verified ? '✅ Verified' : '❌ Failed'}`,
      value: p.id,
    })),
  }]);

  try {
    await agentManager.verifyZKProof(insurerId, proofId);
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
  }
}

// ======================================================
// LIST MY PROOFS
// ======================================================

async function handleListProofs(agentManager) {
  const agents = agentManager.listAgents();

  const { agentId } = await inquirer.prompt([{
    type: 'list',
    name: 'agentId',
    message: 'Select agent:',
    choices: agents.map(a => ({
      name: `${a.name} (${a.type})`,
      value: a.id,
    })),
  }]);

  const proofs = await agentManager.listZKProofs(agentId);

  if (proofs.length === 0) {
    console.log(chalk.yellow('\n⚠️  No ZK proofs found for this agent.\n'));
    return;
  }

  console.log(chalk.magenta(`\n🔐 ZK Proofs for ${agentManager.getAgent(agentId).name}:\n`));

  for (const proof of proofs) {
    const status = proof.verified === true ? chalk.green('✅ Verified') :
                   proof.verified === false ? chalk.red('❌ Failed') :
                   chalk.yellow('⏳ Pending');
    
    console.log(chalk.white(`  ${proof.id.substring(0, 12)}...`));
    console.log(chalk.gray(`    Type:      ${proof.publicInputs?.credentialType || proof.type || 'Unknown'}`));
    console.log(chalk.gray(`    Protocol:  ${proof.protocol || 'N/A'}`));
    console.log(chalk.gray(`    Generated: ${proof.generatedAt || 'N/A'}`));
    console.log(`    Status:    ${status}`);
    
    if (proof.publicInputs?.disclosedClaims) {
      const disclosed = Object.keys(proof.publicInputs.disclosedClaims);
      console.log(chalk.green(`    Disclosed: ${disclosed.join(', ') || 'none'}`));
    }
    if (proof.commitments) {
      console.log(chalk.yellow(`    Hidden:    ${Object.keys(proof.commitments).join(', ')}`));
    }
    console.log('');
  }

  // Option to view full proof
  const { viewFull } = await inquirer.prompt([{
    type: 'confirm',
    name: 'viewFull',
    message: 'View full proof details?',
    default: false,
  }]);

  if (viewFull && agentManager.zkp) {
    const { proofId } = await inquirer.prompt([{
      type: 'list',
      name: 'proofId',
      message: 'Select proof:',
      choices: proofs.map(p => ({
        name: `${p.id.substring(0, 12)}... - ${p.publicInputs?.credentialType || 'Unknown'}`,
        value: p.id,
      })),
    }]);

    const fullProof = proofs.find(p => p.id === proofId);
    if (fullProof) {
      agentManager.zkp.displayProof(fullProof);
    }
  }
}

// ======================================================
// LIST RECEIVED PROOFS (Insurer)
// ======================================================

async function handleListReceived(agentManager) {
  const agents = agentManager.listAgents();
  const insurers = agents.filter(a => a.type === 'insurer');

  if (insurers.length === 0) {
    console.log(chalk.yellow('\n⚠️  No insurer agents found.\n'));
    return;
  }

  const { insurerId } = await inquirer.prompt([{
    type: 'list',
    name: 'insurerId',
    message: 'Select insurer:',
    choices: insurers.map(i => ({ name: i.name, value: i.id })),
  }]);

  const received = await agentManager.listReceivedProofs(insurerId);

  if (received.length === 0) {
    console.log(chalk.yellow('\n⚠️  No received proofs for this insurer.\n'));
    return;
  }

  console.log(chalk.cyan(`\n📥 Received Proofs for ${agentManager.getAgent(insurerId).name}:\n`));

  for (const proof of received) {
    const status = proof.verified === true ? chalk.green('✅ Verified') :
                   proof.verified === false ? chalk.red('❌ Failed') :
                   chalk.yellow('⏳ Not Verified');

    console.log(chalk.white(`  ${proof.id.substring(0, 12)}...`));
    console.log(chalk.gray(`    Type:      ${proof.publicInputs?.credentialType || 'Unknown'}`));
    console.log(chalk.gray(`    From:      ${proof.submittedBy || 'unknown'}`));
    console.log(chalk.gray(`    Submitted: ${proof.submittedAt || 'N/A'}`));
    console.log(`    Status:    ${status}`);
    
    if (proof.publicInputs?.disclosedClaims) {
      console.log(chalk.green(`    Disclosed: ${JSON.stringify(proof.publicInputs.disclosedClaims)}`));
    }
    console.log('');
  }
}

// ======================================================
// RANGE PROOF
// ======================================================

async function handleRangeProof(agentManager) {
  const agents = agentManager.listAgents();
  const patients = agents.filter(a => a.type === 'patient');

  if (patients.length === 0) {
    console.log(chalk.yellow('\n⚠️  No patient agents found.\n'));
    return;
  }

  const { patientId } = await inquirer.prompt([{
    type: 'list',
    name: 'patientId',
    message: 'Select patient:',
    choices: patients.map(p => ({ name: p.name, value: p.id })),
  }]);

  const patient = agentManager.getAgent(patientId);
  
  if (!patient.credentials || patient.credentials.length === 0) {
    console.log(chalk.yellow('\n⚠️  No credentials found.\n'));
    return;
  }

  const { credentialId } = await inquirer.prompt([{
    type: 'list',
    name: 'credentialId',
    message: 'Select credential:',
    choices: patient.credentials.map(c => ({
      name: `${c.type} (from ${c.issuer})`,
      value: c.id,
    })),
  }]);

  const credRecord = patient.credentials.find(c => c.id === credentialId);
  const claims = credRecord.credential?.credentialSubject || {};
  const fields = Object.keys(claims).filter(k => k !== 'id');

  const { fieldName } = await inquirer.prompt([{
    type: 'list',
    name: 'fieldName',
    message: 'Select numeric field for range proof:',
    choices: fields.map(f => ({ name: `${f}: ${claims[f]}`, value: f })),
  }]);

  const { min, max } = await inquirer.prompt([
    { type: 'number', name: 'min', message: 'Minimum value:', default: 0 },
    { type: 'number', name: 'max', message: 'Maximum value:', default: 10000 },
  ]);

  try {
    await agentManager.generateRangeProof(patientId, credentialId, fieldName, min, max);
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
  }
}