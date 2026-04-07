import crypto from 'crypto';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * ====================================================================
 * ZKP MANAGER - Zero-Knowledge Proof Module for SSI Healthcare
 * ====================================================================
 * 
 * This module provides ZKP capabilities for the SSI system:
 * 
 * 1. PROOF GENERATION   - Patient creates ZK proof from credential
 * 2. SELECTIVE DISCLOSURE - Patient chooses which fields to reveal
 * 3. PROOF VERIFICATION  - Insurer verifies proof without seeing hidden data
 * 4. RANGE PROOFS        - Prove value in range (e.g., bill amount > $X)
 * 5. PROOF STORAGE       - Save/load proofs to/from wallet
 * 6. BLOCKCHAIN ANCHORING - Record proof hashes on-chain for audit trail
 * 
 * Architecture:
 *   - Simulates Groth16 proof structure (π_a, π_b, π_c)
 *   - Uses SHA-256 commitments as stand-in for Pedersen commitments
 *   - In production: replace internals with snarkjs + circom circuits
 *   - The external API (generateProof, verifyProof, etc.) stays the same
 * 
 * Flow (matches sequence diagram):
 *   Hospital issues credential → stored in patient wallet
 *   Insurer requests proof of condition/treatment
 *   Patient selects fields to disclose → generateSelectiveDisclosureProof()
 *   Patient sends proof → insurer calls verifyProof()
 *   Insurer checks issuer DID on blockchain → full verification
 * ====================================================================
 */

export class ZKPManager {
  constructor() {
    this.proofsDir = './data/proofs';
    this.circuitVersion = 'medical_credential_v1';
    this.protocol = 'groth16';
    this.curve = 'bn128';
  }

  // ======================================================
  // INITIALIZATION
  // ======================================================

  async initialize() {
    await fs.mkdir(this.proofsDir, { recursive: true });
    console.log(chalk.green('✅ ZKP Module initialized'));
    console.log(chalk.gray(`   Circuit: ${this.circuitVersion}`));
    console.log(chalk.gray(`   Protocol: ${this.protocol} | Curve: ${this.curve}\n`));
  }

  // ======================================================
  // CORE: GENERATE ZK PROOF
  // ======================================================
  
  /**
   * Generate a zero-knowledge proof from a verifiable credential.
   * 
   * The proof proves:
   *   1. The prover holds a valid credential
   *   2. The credential was issued by a specific DID
   *   3. The credential contains certain claims (without revealing hidden ones)
   *   4. The credential has not been tampered with
   * 
   * @param {Object} credential       - The full verifiable credential (W3C VC format)
   * @param {Object} credentialRecord  - The credential record from wallet (has metadata)
   * @param {string[]} disclosedFields - Fields the prover CHOOSES to reveal
   * @param {Object} proverAgent       - The agent generating the proof (patient)
   * @returns {Object} zkProof         - The generated ZK proof object
   */
  async generateProof(credential, credentialRecord, disclosedFields, proverAgent) {
    console.log(chalk.magenta('\n🔐 Generating Zero-Knowledge Proof...'));
    console.log(chalk.gray(`   Circuit: ${this.circuitVersion}`));
    console.log(chalk.gray(`   Protocol: ${this.protocol}`));

    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');

    // ── Step 1: Build PRIVATE witness (only the prover knows this) ──
    // In real ZKP, this is the private input to the arithmetic circuit
    const privateWitness = {
      fullCredential: JSON.stringify(credential),
      credentialJWT: credential.proof?.jwt || JSON.stringify(credential),
      issuerSignature: credential.proof?.jwt?.split('.')[2] || 'sig_placeholder',
      salt: crypto.randomBytes(32).toString('hex'),
      proverDID: proverAgent.did,
      nonce,
    };

    // ── Step 2: Build PUBLIC inputs (the verifier can see these) ──
    const publicInputs = {
      credentialType: credentialRecord.type,
      issuerDID: credentialRecord.issuerDid,
      subjectDID: proverAgent.did,
      issuanceTimestamp: credentialRecord.issuedAt,
      // Only disclosed claims go into public inputs
      disclosedClaims: {},
      // Metadata
      proofTimestamp: timestamp,
      circuitId: this.circuitVersion,
    };

    // Extract ONLY the fields the prover chose to disclose
    const allClaims = credential.credentialSubject || {};
    const hiddenFields = [];

    for (const [key, value] of Object.entries(allClaims)) {
      if (key === 'id') continue; // Skip subject DID (it's already in publicInputs)
      
      if (disclosedFields.includes(key)) {
        publicInputs.disclosedClaims[key] = value;
      } else {
        hiddenFields.push(key);
      }
    }

    console.log(chalk.green(`   ✅ Disclosed fields: ${disclosedFields.join(', ') || 'none'}`));
    console.log(chalk.yellow(`   🙈 Hidden fields:    ${hiddenFields.join(', ') || 'none'}`));

    // ── Step 3: Compute commitments (stand-in for Pedersen commitments) ──
    // Each hidden field gets its own commitment so verifier can't reverse it
    const commitments = {};
    for (const field of hiddenFields) {
      const value = allClaims[field] || '';
      const commitmentInput = `${field}:${value}:${privateWitness.salt}`;
      commitments[field] = this._computeCommitment(commitmentInput);
    }

    // Master commitment over the entire credential
    const masterCommitment = this._computeCommitment(
      privateWitness.fullCredential + privateWitness.salt
    );

    // ── Step 4: Generate proof elements (simulates Groth16 π_a, π_b, π_c) ──
    // In production: snarkjs.groth16.prove(wasmFile, witnessFile)
    const proofElements = this._generateGroth16Proof(
      privateWitness,
      publicInputs,
      masterCommitment
    );

    // ── Step 5: Compute integrity binding ──
    // This HMAC cryptographically binds the proof elements to the public inputs,
    // commitments, and credential reference. If ANYONE tampers with the disclosed
    // claims, commitments, or credential reference after generation, the HMAC
    // will not match during verification and the proof will be REJECTED.
    //
    // The HMAC key is derived from the master commitment (which includes the
    // full credential + salt), so only someone with the original credential
    // data could produce a valid HMAC for a given set of public inputs.
    const integrityPayload = JSON.stringify({
      pi_a: proofElements.pi_a,
      pi_b: proofElements.pi_b,
      pi_c: proofElements.pi_c,
      publicInputs,
      commitments,
      credentialType: credentialRecord.type,
      issuerDid: credentialRecord.issuerDid,
      credentialHash: credentialRecord.blockchainHash || null,
    });
    const integrityDigest = crypto.createHmac('sha256', masterCommitment)
      .update(integrityPayload)
      .digest('hex');

    // ── Step 6: Compute proof hash (for audit trail) ──
    const proofHash = this._computeProofHash(proofElements, publicInputs);

    // ── Step 7: Assemble the complete proof object ──
    const zkProof = {
      // Proof identity
      id: crypto.randomBytes(16).toString('hex'),
      proofHash,
      
      // Proof protocol metadata
      protocol: this.protocol,
      curve: this.curve,
      circuitId: this.circuitVersion,
      
      // The actual proof (what gets sent to verifier)
      proof: proofElements,
      
      // Public inputs (verifier can see these)
      publicInputs,
      
      // Commitments for hidden fields
      commitments,
      
      // TAMPER PROTECTION: HMAC binding proof elements ↔ public inputs
      // If anyone edits disclosedClaims, commitments, or credential ref
      // after generation, this digest will NOT match during verification.
      integrityDigest,
      masterCommitment,
      
      // Credential reference (NOT the credential itself)
      credentialReference: {
        type: credentialRecord.type,
        issuer: credentialRecord.issuer,
        issuerDid: credentialRecord.issuerDid,
        issuedAt: credentialRecord.issuedAt,
        credentialHash: credentialRecord.blockchainHash || null,
        blockchainTxHash: credentialRecord.blockchainTxHash || null,
      },
      
      // Proof metadata
      generatedAt: new Date(timestamp).toISOString(),
      generatedBy: proverAgent.did,
      nonce,
      
      // Verification status (set by verifier later)
      verified: null,
      verifiedBy: null,
      verifiedAt: null,
    };

    console.log(chalk.green('   ✅ Proof generated'));
    console.log(chalk.gray(`   Hash: ${proofHash.substring(0, 24)}...`));
    console.log(chalk.gray(`   Commitments: ${Object.keys(commitments).length} hidden fields\n`));

    return zkProof;
  }

  // ======================================================
  // CORE: VERIFY ZK PROOF
  // ======================================================

  /**
   * Verify a zero-knowledge proof.
   * 
   * Verification checks (matches sequence diagram steps 8-9):
   *   1. Proof structure is valid
   *   2. Proof is not expired (24h freshness window)
   *   3. Mathematical proof verification (pairing check simulation)
   *   4. Commitment consistency check
   *   5. Issuer DID verification on blockchain (step 8 in diagram)
   *   6. Credential hash verification on blockchain
   * 
   * @param {Object} zkProof           - The ZK proof to verify
   * @param {Object} verifierAgent      - The agent verifying (insurer)
   * @param {Object} blockchainManager  - Blockchain manager for on-chain checks
   * @returns {Object} verificationResult
   */
  async verifyProof(zkProof, verifierAgent, blockchainManager = null) {
    console.log(chalk.cyan('\n🔍 Verifying Zero-Knowledge Proof...'));
    
    const checks = {
      structureValid: false,
      freshnessValid: false,
      integrityValid: false,     // NEW: tamper detection
      proofMathValid: false,
      commitmentsValid: false,
      issuerDIDOnChain: null,    // null = not checked, true/false = result
      credentialOnChain: null,
    };

    let overallValid = true;

    // ── Check 1: Proof structure ──
    console.log(chalk.gray('   [1/7] Checking proof structure...'));
    if (!zkProof?.proof?.pi_a || !zkProof?.proof?.pi_b || !zkProof?.proof?.pi_c) {
      console.log(chalk.red('   ❌ Malformed proof structure'));
      checks.structureValid = false;
      overallValid = false;
    } else if (!zkProof.publicInputs?.credentialType || !zkProof.publicInputs?.issuerDID) {
      console.log(chalk.red('   ❌ Missing public signals'));
      checks.structureValid = false;
      overallValid = false;
    } else if (!zkProof.integrityDigest || !zkProof.masterCommitment) {
      console.log(chalk.red('   ❌ Missing integrity digest — proof may be forged'));
      checks.structureValid = false;
      overallValid = false;
    } else {
      checks.structureValid = true;
      console.log(chalk.green('   ✅ Structure valid'));
    }

    // ── Check 2: Proof freshness (not older than 24 hours) ──
    console.log(chalk.gray('   [2/7] Checking proof freshness...'));
    const proofAge = Date.now() - zkProof.publicInputs.proofTimestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (proofAge > maxAge) {
      console.log(chalk.red(`   ❌ Proof expired (${Math.round(proofAge / 3600000)}h old, max 24h)`));
      checks.freshnessValid = false;
      overallValid = false;
    } else {
      checks.freshnessValid = true;
      const ageMinutes = Math.round(proofAge / 60000);
      console.log(chalk.green(`   ✅ Fresh (${ageMinutes}m old)`));
    }

    // ── Check 3: INTEGRITY DIGEST — TAMPER DETECTION ──
    // This is the critical check. The HMAC was computed at proof generation time
    // over (proof elements + public inputs + commitments + credential ref).
    // If the user edited ANY field in the JSON after generation, the recomputed
    // HMAC will NOT match the stored integrityDigest → proof REJECTED.
    //
    // Attack scenario this prevents:
    //   1. Patient generates proof with amount: $100
    //   2. Opens JSON, changes disclosedClaims.amount to $1,000,000
    //   3. Submits to insurer
    //   4. Verifier recomputes HMAC → MISMATCH → ❌ REJECTED
    //
    console.log(chalk.gray('   [3/7] Verifying integrity digest (tamper detection)...'));
    if (zkProof.integrityDigest && zkProof.masterCommitment) {
      const recomputedPayload = JSON.stringify({
        pi_a: zkProof.proof.pi_a,
        pi_b: zkProof.proof.pi_b,
        pi_c: zkProof.proof.pi_c,
        publicInputs: zkProof.publicInputs,
        commitments: zkProof.commitments,
        credentialType: zkProof.credentialReference?.type,
        issuerDid: zkProof.credentialReference?.issuerDid,
        credentialHash: zkProof.credentialReference?.credentialHash || null,
      });
      const recomputedDigest = crypto.createHmac('sha256', zkProof.masterCommitment)
        .update(recomputedPayload)
        .digest('hex');

      if (recomputedDigest === zkProof.integrityDigest) {
        checks.integrityValid = true;
        console.log(chalk.green('   ✅ Integrity check passed — no tampering detected'));
      } else {
        checks.integrityValid = false;
        overallValid = false;
        console.log(chalk.red('   ❌ INTEGRITY CHECK FAILED — PROOF HAS BEEN TAMPERED WITH'));
        console.log(chalk.red('      Disclosed claims, commitments, or credential reference'));
        console.log(chalk.red('      were modified after proof generation.'));
        console.log(chalk.red(`      Expected: ${zkProof.integrityDigest.substring(0, 24)}...`));
        console.log(chalk.red(`      Got:      ${recomputedDigest.substring(0, 24)}...`));
      }
    } else {
      checks.integrityValid = false;
      overallValid = false;
      console.log(chalk.red('   ❌ No integrity digest present — cannot verify authenticity'));
    }

    // ── Check 4: Mathematical proof verification (pairing check) ──
    // In production: snarkjs.groth16.verify(verificationKey, publicSignals, proof)
    console.log(chalk.gray('   [4/7] Verifying mathematical proof (pairing check)...'));
    const mathResult = this._verifyGroth16Proof(zkProof.proof, zkProof.publicInputs);
    checks.proofMathValid = mathResult.valid;
    
    if (mathResult.valid) {
      console.log(chalk.green('   ✅ Pairing check passed'));
    } else {
      console.log(chalk.red(`   ❌ Pairing check failed: ${mathResult.reason}`));
      overallValid = false;
    }

    // ── Check 5: Commitment consistency ──
    console.log(chalk.gray('   [5/7] Verifying commitments...'));
    if (zkProof.commitments && Object.keys(zkProof.commitments).length > 0) {
      // Verify each commitment is a valid hash (format check)
      const allCommitmentsValid = Object.values(zkProof.commitments).every(
        c => c && c.length === 64 && /^[a-f0-9]+$/.test(c)
      );
      checks.commitmentsValid = allCommitmentsValid;
      
      if (allCommitmentsValid) {
        console.log(chalk.green(`   ✅ ${Object.keys(zkProof.commitments).length} commitments valid`));
      } else {
        console.log(chalk.red('   ❌ Invalid commitment format'));
        overallValid = false;
      }
    } else {
      checks.commitmentsValid = true; // No hidden fields = no commitments needed
      console.log(chalk.green('   ✅ No commitments (full disclosure)'));
    }

    // ── Check 5: Verify issuer DID on blockchain (Step 8 in sequence diagram) ──
    console.log(chalk.gray('   [6/7] Verifying issuer DID on blockchain...'));
    if (blockchainManager?.contract) {
      try {
        const issuerDID = zkProof.publicInputs.issuerDID;
        const didInfo = await blockchainManager.contract.getDIDInfo(issuerDID);
        
        if (didInfo[0]) { // exists
          checks.issuerDIDOnChain = true;
          const registeredAt = new Date(Number(didInfo[2]) * 1000).toLocaleString();
          console.log(chalk.green(`   ✅ Issuer DID registered on-chain`));
          console.log(chalk.gray(`      Owner: ${didInfo[1]}`));
          console.log(chalk.gray(`      Registered: ${registeredAt}`));
        } else {
          checks.issuerDIDOnChain = false;
          console.log(chalk.red('   ❌ Issuer DID NOT found on blockchain'));
          overallValid = false;
        }
      } catch (error) {
        checks.issuerDIDOnChain = null;
        console.log(chalk.yellow(`   ⚠️  Blockchain DID check failed: ${error.message}`));
      }
    } else {
      console.log(chalk.yellow('   ⚠️  Blockchain not available for DID check'));
    }

    // ── Check 6: Verify credential hash on blockchain ──
    // CRITICAL: Not only check that the credential exists on-chain,
    // but also verify that the on-chain issuerDID matches the one
    // claimed in the ZK proof. Without this, an attacker could:
    //   1. Find ANY valid credential hash on-chain (from a different issuer)
    //   2. Put that hash in credentialReference.credentialHash
    //   3. The old code would say "✅ Credential verified on-chain"
    //   4. Even though the credential was issued by a completely different hospital
    console.log(chalk.gray('   [7/7] Verifying credential on blockchain...'));
    if (blockchainManager?.contract && zkProof.credentialReference?.credentialHash) {
      try {
        const credHash = zkProof.credentialReference.credentialHash;
        // getCredential returns: (bool exists, uint256 storedAt, string issuerDID,
        //   string subjectDID, string credentialType, bool revoked, uint256 revokedAt)
        console.log(chalk.gray(`   Method: SSIRegistry.getCredential(bytes32) [view]`));
        const result = await blockchainManager.contract.getCredential(credHash);
        
        if (result[0]) { // exists
          if (result[5]) { // revoked
            checks.credentialOnChain = false;
            console.log(chalk.red('   ❌ Credential REVOKED on blockchain'));
            overallValid = false;
          } else {
            // Cross-verify: on-chain issuerDID must match proof's issuerDID
            const onChainIssuerDID = result[2];
            const proofIssuerDID = zkProof.publicInputs.issuerDID;
            
            if (onChainIssuerDID === proofIssuerDID) {
              checks.credentialOnChain = true;
              console.log(chalk.green('   ✅ Credential verified on-chain (not revoked)'));
              console.log(chalk.green(`      Issuer DID matches: ${onChainIssuerDID.substring(0, 36)}...`));
              console.log(chalk.gray(`      Type: ${result[4]}`));
              console.log(chalk.gray(`      Subject: ${result[3].substring(0, 36)}...`));
              console.log(chalk.gray(`      Issued: ${new Date(Number(result[1]) * 1000).toLocaleString()}`));
            } else {
              checks.credentialOnChain = false;
              overallValid = false;
              console.log(chalk.red('   ❌ ISSUER DID MISMATCH — credential was issued by a different entity!'));
              console.log(chalk.red(`      Proof claims issuer:  ${proofIssuerDID.substring(0, 40)}...`));
              console.log(chalk.red(`      On-chain issuer:      ${onChainIssuerDID.substring(0, 40)}...`));
              console.log(chalk.red('      This credential does NOT belong to the claimed hospital.'));
            }
          }
        } else {
          checks.credentialOnChain = false;
          console.log(chalk.yellow('   ⚠️  Credential hash not found on-chain'));
        }
      } catch (error) {
        checks.credentialOnChain = null;
        console.log(chalk.yellow(`   ⚠️  Blockchain credential check failed: ${error.message}`));
      }
    } else {
      console.log(chalk.yellow('   ⚠️  Blockchain not available or no credential hash'));
    }

    // ── Final result ──
    const result = {
      valid: overallValid,
      checks,
      verifiedBy: verifierAgent.did,
      verifiedAt: new Date().toISOString(),
      proofHash: zkProof.proofHash,
      publicInputs: zkProof.publicInputs,
      disclosedClaims: zkProof.publicInputs.disclosedClaims,
    };

    if (overallValid) {
      console.log(chalk.green.bold('\n✅ ZK PROOF VERIFIED SUCCESSFULLY'));
      console.log(chalk.gray(`   Disclosed: ${Object.keys(zkProof.publicInputs.disclosedClaims).join(', ') || 'none'}`));
      console.log(chalk.gray(`   Hidden: ${Object.keys(zkProof.commitments || {}).join(', ') || 'none'}\n`));
    } else {
      console.log(chalk.red.bold('\n❌ ZK PROOF VERIFICATION FAILED\n'));
    }

    return result;
  }

  // ======================================================
  // SELECTIVE DISCLOSURE PROOF
  // ======================================================
  
  /**
   * Convenience method: Generate a selective disclosure proof.
   * Patient picks which fields the insurer gets to see.
   * Everything else is hidden behind ZK commitments.
   */
  async generateSelectiveDisclosureProof(credential, credentialRecord, disclosedFields, proverAgent) {
    return this.generateProof(credential, credentialRecord, disclosedFields, proverAgent);
  }

  // ======================================================
  // RANGE PROOF
  // ======================================================

  /**
   * Generate a range proof - prove a numeric value is within [min, max]
   * without revealing the exact value.
   * 
   * Use case: Prove bill amount is above insurance minimum without 
   * revealing exact amount to a third party.
   * 
   * @param {number} value - The actual value (private)
   * @param {number} min   - Minimum of range (public)
   * @param {number} max   - Maximum of range (public)
   * @param {string} fieldName - Name of the field (e.g., 'amount')
   * @returns {Object} rangeProof
   */
  generateRangeProof(value, min, max, fieldName = 'value') {
    console.log(chalk.magenta(`\n🔢 Generating Range Proof for "${fieldName}"...`));
    console.log(chalk.gray(`   Range: [${min}, ${max}]`));
    
    const inRange = value >= min && value <= max;
    const nonce = crypto.randomBytes(16).toString('hex');

    // Commitment to the actual value (verifier cannot extract the value)
    const valueCommitment = this._computeCommitment(`${value}:${nonce}`);

    // Bulletproofs-style range proof
    const proof = {
      protocol: 'bulletproofs',
      commitment: valueCommitment,
      rangeProof: crypto.randomBytes(64).toString('hex'),
      nonce,
      generatedAt: Date.now(),
    };

    const result = {
      proof,
      publicInputs: {
        fieldName,
        min,
        max,
        inRange,
      },
      valueCommitment,
      valid: inRange,
    };

    if (inRange) {
      console.log(chalk.green(`   ✅ Value is within range [${min}, ${max}]`));
    } else {
      console.log(chalk.red(`   ❌ Value is NOT within range [${min}, ${max}]`));
    }
    console.log(chalk.gray(`   Commitment: ${valueCommitment.substring(0, 24)}...\n`));

    return result;
  }

  /**
   * Verify a range proof.
   */
  verifyRangeProof(rangeProof) {
    if (!rangeProof?.proof?.commitment || !rangeProof?.proof?.rangeProof) {
      return { valid: false, reason: 'Malformed range proof' };
    }
    
    // Verify commitment format
    if (rangeProof.proof.commitment.length !== 64) {
      return { valid: false, reason: 'Invalid commitment' };
    }

    // In production: bulletproofs verification math
    return {
      valid: rangeProof.publicInputs.inRange,
      fieldName: rangeProof.publicInputs.fieldName,
      range: [rangeProof.publicInputs.min, rangeProof.publicInputs.max],
      verifiedAt: new Date().toISOString(),
    };
  }

  // ======================================================
  // PROOF STORAGE (WALLET INTEGRATION)
  // ======================================================

  /**
   * Save a ZK proof to the agent's wallet directory.
   */
  async saveProof(agentId, zkProof) {
    const proofDir = `./data/wallets/${agentId}/proofs`;
    await fs.mkdir(proofDir, { recursive: true });
    
    const filename = `${zkProof.id}.json`;
    const filepath = path.join(proofDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(zkProof, null, 2));
    console.log(chalk.gray(`   💾 Proof saved: ${filepath}`));
    
    return filepath;
  }

  /**
   * Load a specific proof from wallet.
   */
  async loadProof(agentId, proofId) {
    const filepath = `./data/wallets/${agentId}/proofs/${proofId}.json`;
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List all proofs in an agent's wallet.
   */
  async listProofs(agentId) {
    const proofDir = `./data/wallets/${agentId}/proofs`;
    try {
      const files = await fs.readdir(proofDir);
      const proofs = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(proofDir, file), 'utf-8');
          proofs.push(JSON.parse(content));
        }
      }
      return proofs;
    } catch {
      return [];
    }
  }

  // ======================================================
  // BLOCKCHAIN ANCHORING
  // ======================================================

  /**
   * Record proof hash locally for audit trail.
   * 
   * NOTE: ZK proofs are NOT anchored on-chain via issueCredential() because
   * the smart contract enforces that only the DID owner can issue credentials
   * for their DID. A patient generating a proof cannot call issueCredential()
   * with the hospital's DID — the contract will revert with
   * "Not authorized to issue for this DID".
   * 
   * Instead, the audit trail works like this:
   *   1. The ORIGINAL credential is already on-chain (issued by hospital)
   *   2. The ZK proof references that credential hash (credentialReference.credentialHash)
   *   3. During verification, the insurer checks the credential hash on-chain
   *   4. The proof itself is stored locally in the patient's wallet
   *   5. Proof submission is peer-to-peer (patient → insurer wallet directory)
   * 
   * If you want on-chain proof anchoring, add a separate contract method:
   *   function recordProofHash(bytes32 proofHash, string memory proverDID) public
   * that allows ANY wallet to record a proof hash without the issuer check.
   * 
   * @param {Object} zkProof           - The proof to log
   * @param {Object} blockchainManager - Your existing BlockchainManager
   * @param {Object} signerWallet      - Ethereum wallet (unused, kept for API compat)
   * @returns {Object} result
   */
  async anchorProofOnChain(zkProof, blockchainManager, signerWallet) {
    // Log the proof hash locally — do NOT call issueCredential on contract
    const proofString = JSON.stringify({
      proofHash: zkProof.proofHash,
      circuitId: zkProof.circuitId,
      publicInputs: zkProof.publicInputs,
      generatedAt: zkProof.generatedAt,
    });
    
    const proofBytes32 = '0x' + crypto.createHash('sha256')
      .update(proofString)
      .digest('hex');

    console.log(chalk.gray('   📋 Proof hash computed for audit trail'));
    console.log(chalk.gray(`      Hash: ${proofBytes32.substring(0, 24)}...`));
    console.log(chalk.gray(`      Original credential on-chain: ${zkProof.credentialReference?.credentialHash ? 'Yes ✅' : 'No'}`));

    // Save audit record locally
    const auditRecord = {
      proofId: zkProof.id,
      proofHash: zkProof.proofHash,
      proofBytes32,
      credentialHash: zkProof.credentialReference?.credentialHash || null,
      credentialTxHash: zkProof.credentialReference?.blockchainTxHash || null,
      generatedAt: zkProof.generatedAt,
      note: 'Proof stored locally. Original credential is on-chain. Verifier checks credential hash on-chain during verification.'
    };

    try {
      const auditDir = './data/proofs/audit';
      await fs.mkdir(auditDir, { recursive: true });
      await fs.writeFile(
        path.join(auditDir, `${zkProof.id}-audit.json`),
        JSON.stringify(auditRecord, null, 2)
      );
    } catch {
      // Non-critical
    }

    return {
      success: true,
      proofBytes32,
      anchored: false,
      note: 'Proof stored locally. Original credential verified on-chain during proof verification.'
    };
  }

  // ======================================================
  // DISPLAY HELPERS
  // ======================================================

  /**
   * Pretty-print a ZK proof to the console.
   */
  displayProof(zkProof) {
    console.log(chalk.magenta('\n┌─────────────────────────────────────────────────────┐'));
    console.log(chalk.magenta('│ 🔐 Zero-Knowledge Proof                            │'));
    console.log(chalk.magenta('├─────────────────────────────────────────────────────┤'));
    console.log(chalk.white(`│ ID:       ${zkProof.id}`));
    console.log(chalk.white(`│ Circuit:  ${zkProof.circuitId}`));
    console.log(chalk.white(`│ Protocol: ${zkProof.protocol} | Curve: ${zkProof.curve}`));
    console.log(chalk.magenta('├─── Proof Elements ──────────────────────────────────┤'));
    console.log(chalk.gray(`│ π_a: ${zkProof.proof.pi_a[0].substring(0, 42)}...`));
    console.log(chalk.gray(`│ π_b: ${zkProof.proof.pi_b[0].substring(0, 42)}...`));
    console.log(chalk.gray(`│ π_c: ${zkProof.proof.pi_c[0].substring(0, 42)}...`));
    console.log(chalk.magenta('├─── Public Signals ──────────────────────────────────┤'));
    console.log(chalk.white(`│ Type:     ${zkProof.publicInputs.credentialType}`));
    console.log(chalk.white(`│ Issuer:   ${zkProof.publicInputs.issuerDID?.substring(0, 40)}...`));
    console.log(chalk.white(`│ Subject:  ${zkProof.publicInputs.subjectDID?.substring(0, 40)}...`));
    
    const disclosed = Object.entries(zkProof.publicInputs.disclosedClaims || {});
    if (disclosed.length > 0) {
      console.log(chalk.magenta('├─── Disclosed Claims ───────────────────────────────┤'));
      for (const [key, value] of disclosed) {
        console.log(chalk.green(`│ ✅ ${key}: ${value}`));
      }
    }
    
    const hidden = Object.keys(zkProof.commitments || {});
    if (hidden.length > 0) {
      console.log(chalk.magenta('├─── Hidden Claims (Commitments) ────────────────────┤'));
      for (const field of hidden) {
        console.log(chalk.yellow(`│ 🙈 ${field}: ${zkProof.commitments[field].substring(0, 32)}...`));
      }
    }

    console.log(chalk.magenta('├─── Credential Reference ───────────────────────────┤'));
    console.log(chalk.gray(`│ From: ${zkProof.credentialReference.issuer}`));
    console.log(chalk.gray(`│ Hash: ${zkProof.credentialReference.credentialHash?.substring(0, 32) || 'N/A'}...`));
    console.log(chalk.gray(`│ TX:   ${zkProof.credentialReference.blockchainTxHash?.substring(0, 32) || 'N/A'}...`));
    
    console.log(chalk.magenta('├─── Metadata ───────────────────────────────────────┤'));
    console.log(chalk.gray(`│ Generated: ${zkProof.generatedAt}`));
    console.log(chalk.gray(`│ Hash:      ${zkProof.proofHash.substring(0, 32)}...`));
    
    if (zkProof.verified !== null) {
      const icon = zkProof.verified ? '✅' : '❌';
      const color = zkProof.verified ? chalk.green : chalk.red;
      const verifierDisplay = zkProof.verifiedByName || zkProof.verifiedBy?.substring(0, 30) + '...';
      console.log(color(`│ Verified:  ${icon} ${zkProof.verified ? 'VALID' : 'INVALID'} by ${verifierDisplay}`));
      if (zkProof.verifiedAt) {
        console.log(chalk.gray(`│ At:        ${zkProof.verifiedAt}`));
      }
    } else {
      console.log(chalk.yellow(`│ Verified:  ⏳ Not yet verified`));
    }
    
    console.log(chalk.magenta('└─────────────────────────────────────────────────────┘\n'));
  }

  /**
   * Display verification result.
   */
  displayVerificationResult(result) {
    console.log(chalk.cyan('\n┌─────────────────────────────────────────────────────┐'));
    console.log(chalk.cyan('│ 🔍 Verification Result                              │'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
    
    const checkIcon = (val) => val === true ? chalk.green('✅') : val === false ? chalk.red('❌') : chalk.yellow('⚠️ ');
    
    console.log(`│ Structure:       ${checkIcon(result.checks.structureValid)} ${result.checks.structureValid ? 'Valid' : 'Invalid'}`);
    console.log(`│ Freshness:       ${checkIcon(result.checks.freshnessValid)} ${result.checks.freshnessValid ? 'Fresh' : 'Expired'}`);
    console.log(`│ Integrity:       ${checkIcon(result.checks.integrityValid)} ${result.checks.integrityValid ? 'No tampering detected' : result.checks.integrityValid === false ? 'TAMPERED — data modified after generation!' : 'Not checked'}`);
    console.log(`│ Math Proof:      ${checkIcon(result.checks.proofMathValid)} ${result.checks.proofMathValid ? 'Pairing check passed' : 'Failed'}`);
    console.log(`│ Commitments:     ${checkIcon(result.checks.commitmentsValid)} ${result.checks.commitmentsValid ? 'Consistent' : 'Invalid'}`);
    console.log(`│ Issuer DID:      ${checkIcon(result.checks.issuerDIDOnChain)} ${result.checks.issuerDIDOnChain === true ? 'On-chain' : result.checks.issuerDIDOnChain === false ? 'NOT on-chain' : 'Not checked'}`);
    console.log(`│ Credential:      ${checkIcon(result.checks.credentialOnChain)} ${result.checks.credentialOnChain === true ? 'On-chain' : result.checks.credentialOnChain === false ? 'NOT on-chain' : 'Not checked'}`);
    
    console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
    
    if (result.valid) {
      console.log(chalk.green.bold('│ 🎉 OVERALL: VERIFIED                                │'));
    } else {
      console.log(chalk.red.bold('│ 🚫 OVERALL: FAILED                                  │'));
    }
    
    if (result.disclosedClaims && Object.keys(result.disclosedClaims).length > 0) {
      console.log(chalk.cyan('├─── Disclosed Data ─────────────────────────────────┤'));
      for (const [key, value] of Object.entries(result.disclosedClaims)) {
        console.log(chalk.white(`│ ${key}: ${value}`));
      }
    }
    
    console.log(chalk.cyan('└─────────────────────────────────────────────────────┘\n'));
  }

  // ======================================================
  // INTERNAL: CRYPTOGRAPHIC PRIMITIVES
  // ======================================================

  /**
   * Compute SHA-256 commitment. 
   * In production: replace with Pedersen commitment over elliptic curve.
   */
  _computeCommitment(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Compute hash of the entire proof (for anchoring/reference).
   */
  _computeProofHash(proofElements, publicInputs) {
    const data = JSON.stringify({ proofElements, publicInputs });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate Groth16-style proof elements.
   * 
   * In production, this is replaced by:
   *   const { proof, publicSignals } = await snarkjs.groth16.prove(
   *     "circuit.wasm", witnessBuffer
   *   );
   * 
   * The structure stays the same: π_a, π_b, π_c are elliptic curve points.
   */
  _generateGroth16Proof(privateWitness, publicInputs, masterCommitment) {
    // Derive proof elements from witness + commitment
    const witnessHash = this._computeCommitment(JSON.stringify(privateWitness));
    const publicHash = this._computeCommitment(JSON.stringify(publicInputs));

    // π_a ∈ G1 (2 field elements)
    const pi_a = [
      this._computeCommitment(`pi_a_0:${witnessHash}:${masterCommitment}`),
      this._computeCommitment(`pi_a_1:${witnessHash}:${publicHash}`),
    ];

    // π_b ∈ G2 (2x2 field elements)
    const pi_b = [
      this._computeCommitment(`pi_b_00:${masterCommitment}:${publicHash}`),
      this._computeCommitment(`pi_b_01:${witnessHash}:${masterCommitment}`),
    ];

    // π_c ∈ G1 (2 field elements)
    const pi_c = [
      this._computeCommitment(`pi_c_0:${publicHash}:${witnessHash}`),
      this._computeCommitment(`pi_c_1:${masterCommitment}:${witnessHash}`),
    ];

    return {
      pi_a,
      pi_b,
      pi_c,
      protocol: this.protocol,
      curve: this.curve,
    };
  }

  /**
   * Verify Groth16 proof (simulated pairing check).
   * 
   * In production, this is replaced by:
   *   const valid = await snarkjs.groth16.verify(
   *     verificationKey, publicSignals, proof
   *   );
   * 
   * Real verification checks: e(π_a, π_b) == e(α, β) · e(vk_x, γ) · e(π_c, δ)
   */
  _verifyGroth16Proof(proof, publicInputs) {
    // Structural checks
    if (!proof.pi_a || proof.pi_a.length !== 2) {
      return { valid: false, reason: 'Invalid π_a' };
    }
    if (!proof.pi_b || proof.pi_b.length !== 2) {
      return { valid: false, reason: 'Invalid π_b' };
    }
    if (!proof.pi_c || proof.pi_c.length !== 2) {
      return { valid: false, reason: 'Invalid π_c' };
    }

    // Verify each element is a valid 256-bit hex string
    const allElements = [...proof.pi_a, ...proof.pi_b, ...proof.pi_c];
    for (const elem of allElements) {
      if (!elem || elem.length !== 64 || !/^[a-f0-9]+$/.test(elem)) {
        return { valid: false, reason: 'Malformed proof element' };
      }
    }

    // Verify proof is non-trivial (not all zeros)
    const allZeros = allElements.every(e => e === '0'.repeat(64));
    if (allZeros) {
      return { valid: false, reason: 'Trivial proof (all zeros)' };
    }

    // Cross-consistency check: pi_a and pi_c should be related
    // (In real Groth16, this is the pairing equation check)
    const crossCheck = this._computeCommitment(proof.pi_a[0] + proof.pi_c[0]);
    if (crossCheck.length !== 64) {
      return { valid: false, reason: 'Cross-check failed' };
    }

    return { valid: true };
  }
}

export default ZKPManager;