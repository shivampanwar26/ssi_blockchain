import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("SSIRegistry", function () {
  let ssiRegistry;
  let owner, addr1, addr2;
  
  const testDID1 = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
  const testDID2 = "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH";
  const testDID3 = "did:key:z6MkrHKzgsahxBLyNAbLQyB1pcWNYC9GmywiWPgkrvntAZcj";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const SSIRegistry = await ethers.getContractFactory("SSIRegistry");
    ssiRegistry = await SSIRegistry.deploy();
    await ssiRegistry.waitForDeployment();
  });

  describe("DID Registration", function () {
    it("Should register a new DID", async function () {
      await expect(ssiRegistry.registerDID(testDID1))
        .to.emit(ssiRegistry, "DIDRegistered")
        .withArgs(testDID1, owner.address, await getBlockTimestamp());
      
      const didInfo = await ssiRegistry.getDIDInfo(testDID1);
      expect(didInfo.exists).to.be.true;
      expect(didInfo.owner).to.equal(owner.address);
    });

    it("Should not allow duplicate DID registration", async function () {
      await ssiRegistry.registerDID(testDID1);
      
      await expect(ssiRegistry.registerDID(testDID1))
        .to.be.revertedWith("DID already registered");
    });

    it("Should not allow empty DID", async function () {
      await expect(ssiRegistry.registerDID(""))
        .to.be.revertedWith("DID cannot be empty");
    });

    it("Should track multiple DIDs for same owner", async function () {
      await ssiRegistry.registerDID(testDID1);
      await ssiRegistry.registerDID(testDID2);
      
      const dids = await ssiRegistry.getDIDsByOwner(owner.address);
      expect(dids.length).to.equal(2);
      expect(dids).to.include(testDID1);
      expect(dids).to.include(testDID2);
    });
  });

  describe("Credential Issuance", function () {
    let credentialHash;

    beforeEach(async function () {
      // Register DIDs for issuer and subject
      await ssiRegistry.connect(owner).registerDID(testDID1);
      await ssiRegistry.connect(addr1).registerDID(testDID2);
      
      // Create credential hash
      const credentialData = {
        type: "VaccinationRecord",
        vaccine: "COVID-19",
        date: "2024-01-15"
      };
      credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credentialData)));
    });

    it("Should issue a credential", async function () {
      await expect(
        ssiRegistry.issueCredential(
          credentialHash,
          testDID1,
          testDID2,
          "VaccinationRecord"
        )
      ).to.emit(ssiRegistry, "CredentialIssued");

      const result = await ssiRegistry.verifyCredential(credentialHash);
      expect(result.exists).to.be.true;
      expect(result.issuerDID).to.equal(testDID1);
      expect(result.subjectDID).to.equal(testDID2);
      expect(result.credentialType).to.equal("VaccinationRecord");
      expect(result.revoked).to.be.false;
    });

    it("Should not allow duplicate credential", async function () {
      await ssiRegistry.issueCredential(
        credentialHash,
        testDID1,
        testDID2,
        "VaccinationRecord"
      );

      await expect(
        ssiRegistry.issueCredential(
          credentialHash,
          testDID1,
          testDID2,
          "VaccinationRecord"
        )
      ).to.be.revertedWith("Credential already exists");
    });

    it("Should require both DIDs to be registered", async function () {
      await expect(
        ssiRegistry.issueCredential(
          credentialHash,
          testDID1,
          testDID3, // Not registered
          "VaccinationRecord"
        )
      ).to.be.revertedWith("Subject DID not registered");
    });

    it("Should only allow DID owner to issue credentials", async function () {
      await expect(
        ssiRegistry.connect(addr1).issueCredential(
          credentialHash,
          testDID1, // Owned by owner, not addr1
          testDID2,
          "VaccinationRecord"
        )
      ).to.be.revertedWith("Not authorized to issue for this DID");
    });

    it("Should increment credential count", async function () {
      const countBefore = await ssiRegistry.getCredentialCount();
      
      await ssiRegistry.issueCredential(
        credentialHash,
        testDID1,
        testDID2,
        "VaccinationRecord"
      );
      
      const countAfter = await ssiRegistry.getCredentialCount();
      expect(countAfter).to.equal(countBefore + BigInt(1));
    });
  });

  describe("Credential Verification", function () {
    let credentialHash;

    beforeEach(async function () {
      await ssiRegistry.connect(owner).registerDID(testDID1);
      await ssiRegistry.connect(addr1).registerDID(testDID2);
      
      const credentialData = {
        type: "VaccinationRecord",
        vaccine: "COVID-19"
      };
      credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credentialData)));
      
      await ssiRegistry.issueCredential(
        credentialHash,
        testDID1,
        testDID2,
        "VaccinationRecord"
      );
    });

    it("Should verify an existing credential", async function () {
      const result = await ssiRegistry.verifyCredential(credentialHash);
      
      expect(result.exists).to.be.true;
      expect(result.issuerDID).to.equal(testDID1);
      expect(result.subjectDID).to.equal(testDID2);
      expect(result.credentialType).to.equal("VaccinationRecord");
      expect(result.revoked).to.be.false;
      expect(result.issuedAt).to.be.gt(0);
    });

    it("Should return false for non-existent credential", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const result = await ssiRegistry.verifyCredential(fakeHash);
      
      expect(result.exists).to.be.false;
    });

    it("Should get full credential details", async function () {
      const details = await ssiRegistry.getCredential(credentialHash);
      
      expect(details.issuerDID).to.equal(testDID1);
      expect(details.subjectDID).to.equal(testDID2);
      expect(details.credentialType).to.equal("VaccinationRecord");
      expect(details.revoked).to.be.false;
      expect(details.issuedAt).to.be.gt(0);
    });
  });

  describe("Credential Revocation", function () {
    let credentialHash;

    beforeEach(async function () {
      await ssiRegistry.connect(owner).registerDID(testDID1);
      await ssiRegistry.connect(addr1).registerDID(testDID2);
      
      const credentialData = { type: "Test", data: "test" };
      credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credentialData)));
      
      await ssiRegistry.issueCredential(
        credentialHash,
        testDID1,
        testDID2,
        "TestCredential"
      );
    });

    it("Should revoke a credential", async function () {
      await expect(ssiRegistry.revokeCredential(credentialHash))
        .to.emit(ssiRegistry, "CredentialRevoked")
        .withArgs(credentialHash, await getBlockTimestamp());
      
      const result = await ssiRegistry.verifyCredential(credentialHash);
      expect(result.revoked).to.be.true;
    });

    it("Should only allow issuer to revoke", async function () {
      await expect(
        ssiRegistry.connect(addr1).revokeCredential(credentialHash)
      ).to.be.revertedWith("Only issuer can revoke credential");
    });

    it("Should not allow double revocation", async function () {
      await ssiRegistry.revokeCredential(credentialHash);
      
      await expect(
        ssiRegistry.revokeCredential(credentialHash)
      ).to.be.revertedWith("Credential already revoked");
    });

    it("Should check revocation status", async function () {
      const beforeRevoke = await ssiRegistry.isRevoked(credentialHash);
      expect(beforeRevoke.revoked).to.be.false;
      expect(beforeRevoke.revokedAt).to.equal(0);
      
      await ssiRegistry.revokeCredential(credentialHash);
      
      const afterRevoke = await ssiRegistry.isRevoked(credentialHash);
      expect(afterRevoke.revoked).to.be.true;
      expect(afterRevoke.revokedAt).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple credentials for same subject", async function () {
      await ssiRegistry.connect(owner).registerDID(testDID1);
      await ssiRegistry.connect(addr1).registerDID(testDID2);
      
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("cred1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("cred2"));
      
      await ssiRegistry.issueCredential(hash1, testDID1, testDID2, "Type1");
      await ssiRegistry.issueCredential(hash2, testDID1, testDID2, "Type2");
      
      const result1 = await ssiRegistry.verifyCredential(hash1);
      const result2 = await ssiRegistry.verifyCredential(hash2);
      
      expect(result1.exists).to.be.true;
      expect(result2.exists).to.be.true;
    });

    it("Should handle long DID strings", async function () {
      const longDID = "did:key:" + "z".repeat(100);
      await ssiRegistry.registerDID(longDID);
      
      const didInfo = await ssiRegistry.getDIDInfo(longDID);
      expect(didInfo.exists).to.be.true;
    });
  });

  // Helper function to get current block timestamp
  async function getBlockTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  }
});