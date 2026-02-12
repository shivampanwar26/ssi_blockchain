// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SSIRegistry
 * @dev Self-Sovereign Identity Registry on Ethereum
 * Manages DIDs and Verifiable Credentials on-chain
 */
contract SSIRegistry {
    
    // Structures
    struct DIDRecord {
        bool exists;
        address owner;
        uint256 registeredAt;
    }
    
    struct CredentialRecord {
        bool exists;
        uint256 issuedAt;
        string issuerDID;
        string subjectDID;
        string credentialType;
        bool revoked;
        uint256 revokedAt;
    }
    
    // State variables
    mapping(string => DIDRecord) private dids;
    mapping(bytes32 => CredentialRecord) private credentials;
    mapping(address => string[]) private ownerToDIDs;
    
    uint256 private credentialCount;
    
    // Events
    event DIDRegistered(
        string indexed did,
        address indexed owner,
        uint256 timestamp
    );
    
    event CredentialIssued(
        bytes32 indexed credentialHash,
        string issuerDID,
        string subjectDID,
        string credentialType,
        uint256 timestamp
    );
    
    event CredentialRevoked(
        bytes32 indexed credentialHash,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyDIDOwner(string memory did) {
        require(dids[did].exists, "DID does not exist");
        require(dids[did].owner == msg.sender, "Not the DID owner");
        _;
    }
    
    modifier credentialExists(bytes32 credentialHash) {
        require(credentials[credentialHash].exists, "Credential does not exist");
        _;
    }
    
    /**
     * @dev Register a new DID
     * @param did The decentralized identifier to register
     * @return success Whether registration was successful
     */
    function registerDID(string memory did) public returns (bool) {
        require(!dids[did].exists, "DID already registered");
        require(bytes(did).length > 0, "DID cannot be empty");
        
        dids[did] = DIDRecord({
            exists: true,
            owner: msg.sender,
            registeredAt: block.timestamp
        });
        
        ownerToDIDs[msg.sender].push(did);
        
        emit DIDRegistered(did, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Issue a new credential on-chain
     * @param credentialHash Hash of the credential data
     * @param issuerDID DID of the issuer
     * @param subjectDID DID of the subject
     * @param credentialType Type of credential
     * @return success Whether issuance was successful
     */
    function issueCredential(
        bytes32 credentialHash,
        string memory issuerDID,
        string memory subjectDID,
        string memory credentialType
    ) public returns (bool) {
        require(!credentials[credentialHash].exists, "Credential already exists");
        require(dids[issuerDID].exists, "Issuer DID not registered");
        require(dids[subjectDID].exists, "Subject DID not registered");
        require(dids[issuerDID].owner == msg.sender, "Not authorized to issue for this DID");
        
        credentials[credentialHash] = CredentialRecord({
            exists: true,
            issuedAt: block.timestamp,
            issuerDID: issuerDID,
            subjectDID: subjectDID,
            credentialType: credentialType,
            revoked: false,
            revokedAt: 0
        });
        
        credentialCount++;
        
        emit CredentialIssued(
            credentialHash,
            issuerDID,
            subjectDID,
            credentialType,
            block.timestamp
        );
        
        return true;
    }
    
    /**
     * @dev Revoke a credential
     * @param credentialHash Hash of the credential to revoke
     * @return success Whether revocation was successful
     */
    function revokeCredential(bytes32 credentialHash) 
        public 
        credentialExists(credentialHash) 
        returns (bool) 
    {
        CredentialRecord storage cred = credentials[credentialHash];
        require(!cred.revoked, "Credential already revoked");
        
        // Only issuer can revoke
        require(
            dids[cred.issuerDID].owner == msg.sender,
            "Only issuer can revoke credential"
        );
        
        cred.revoked = true;
        cred.revokedAt = block.timestamp;
        
        emit CredentialRevoked(credentialHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify a credential's status
     * @param credentialHash Hash of the credential to verify
     * @return exists Whether credential exists
     * @return issuedAt When credential was issued
     * @return issuerDID DID of issuer
     * @return subjectDID DID of subject
     * @return credentialType Type of credential
     * @return revoked Whether credential is revoked
     */
    function verifyCredential(bytes32 credentialHash) 
        public 
        view 
        returns (
            bool exists,
            uint256 issuedAt,
            string memory issuerDID,
            string memory subjectDID,
            string memory credentialType,
            bool revoked
        ) 
    {
        CredentialRecord storage cred = credentials[credentialHash];
        
        return (
            cred.exists,
            cred.issuedAt,
            cred.issuerDID,
            cred.subjectDID,
            cred.credentialType,
            cred.revoked
        );
    }
    
    /**
     * @dev Get DID information
     * @param did The DID to query
     * @return exists Whether DID exists
     * @return owner Address of DID owner
     * @return registeredAt When DID was registered
     */
    function getDIDInfo(string memory did) 
        public 
        view 
        returns (
            bool exists,
            address owner,
            uint256 registeredAt
        ) 
    {
        DIDRecord storage record = dids[did];
        return (record.exists, record.owner, record.registeredAt);
    }
    
    /**
     * @dev Get all DIDs owned by an address
     * @param owner Address to query
     * @return Array of DIDs owned by the address
     */
    function getDIDsByOwner(address owner) 
        public 
        view 
        returns (string[] memory) 
    {
        return ownerToDIDs[owner];
    }
    
    /**
     * @dev Get total number of credentials issued
     * @return Total credential count
     */
    function getCredentialCount() public view returns (uint256) {
        return credentialCount;
    }
    
    /**
     * @dev Check if a credential is revoked
     * @param credentialHash Hash of the credential
     * @return revoked Whether credential is revoked
     * @return revokedAt When credential was revoked (0 if not revoked)
     */
    function isRevoked(bytes32 credentialHash) 
        public 
        view 
        credentialExists(credentialHash)
        returns (bool revoked, uint256 revokedAt) 
    {
        CredentialRecord storage cred = credentials[credentialHash];
        return (cred.revoked, cred.revokedAt);
    }
    
    /**
     * @dev Get credential details
     * @param credentialHash Hash of the credential
     * @return issuedAt When credential was issued
     * @return issuerDID DID of issuer
     * @return subjectDID DID of subject
     * @return credentialType Type of credential
     * @return revoked Whether credential is revoked
     * @return revokedAt When credential was revoked (0 if not revoked)
     */
    function getCredential(bytes32 credentialHash)
        public
        view
        credentialExists(credentialHash)
        returns (
            uint256 issuedAt,
            string memory issuerDID,
            string memory subjectDID,
            string memory credentialType,
            bool revoked,
            uint256 revokedAt
        )
    {
        CredentialRecord storage cred = credentials[credentialHash];
        return (
            cred.issuedAt,
            cred.issuerDID,
            cred.subjectDID,
            cred.credentialType,
            cred.revoked,
            cred.revokedAt
        );
    }
}
