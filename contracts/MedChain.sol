// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MedChain — Decentralised Medical Record Access Control
/// @notice Patients own their records; doctors must request and receive patient approval.
///         Encryption keys and medical content are NEVER stored on-chain.
contract MedChain {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum Role { None, Patient, Doctor }

    enum AccessStatus { None, Pending, Approved, Rejected, Revoked }

    struct Record {
        bytes32   recordId;      // keccak256 of (patient, nonce)
        address   patient;
        string    ipfsCid;       // CID of AES-256-GCM-encrypted file on IPFS
        string    recordName;    // human-readable label
        uint256   uploadedAt;
        bool      exists;
    }

    struct AccessRequest {
        bytes32      recordId;
        address      doctor;
        address      patient;
        uint256      requestedAt;
        uint256      expiresAt;   // 0 = no expiry enforced at contract level
        AccessStatus status;
        // encryptedKey: stored off-chain; on approval the backend sends the
        // AES key encrypted with the doctor's public key.  Nothing secret here.
        string       encryptedKeyRef; // optional reference handle (not the key)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    mapping(address => Role) public roles;

    /// recordId → Record
    mapping(bytes32 => Record) private _records;

    /// patient → list of their recordIds
    mapping(address => bytes32[]) private _patientRecords;

    /// requestKey(recordId, doctor) → AccessRequest
    mapping(bytes32 => AccessRequest) private _requests;

    /// doctor → list of request keys (recordId, doctor)
    mapping(address => bytes32[]) private _doctorRequests;

    /// patient address nonce for unique recordId generation
    mapping(address => uint256) private _nonce;

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotRegistered();
    error AlreadyRegistered();
    error NotPatient();
    error NotDoctor();
    error RecordDoesNotExist();
    error NotRecordOwner();
    error RequestAlreadyExists();
    error RequestDoesNotExist();
    error RequestNotPending();
    error AccessNotApproved();
    error AccessExpired();
    error EmptyString();
    error InvalidExpiry();

    // ─────────────────────────────────────────────────────────────────────────
    // Events  (no PII, no keys, no medical data)
    // ─────────────────────────────────────────────────────────────────────────

    event UserRegistered(address indexed user, Role role);
    event RecordUploaded(bytes32 indexed recordId, address indexed patient, uint256 uploadedAt);
    event AccessRequested(bytes32 indexed recordId, address indexed doctor, uint256 requestedAt);
    event AccessApproved(bytes32 indexed recordId, address indexed doctor, uint256 expiresAt);
    event AccessRejected(bytes32 indexed recordId, address indexed doctor);
    event AccessRevoked(bytes32 indexed recordId, address indexed doctor);
    event RecordAccessed(bytes32 indexed recordId, address indexed doctor, uint256 accessedAt);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyRegistered() {
        if (roles[msg.sender] == Role.None) revert NotRegistered();
        _;
    }

    modifier onlyPatient() {
        if (roles[msg.sender] != Role.Patient) revert NotPatient();
        _;
    }

    modifier onlyDoctor() {
        if (roles[msg.sender] != Role.Doctor) revert NotDoctor();
        _;
    }

    modifier recordExists(bytes32 recordId) {
        if (!_records[recordId].exists) revert RecordDoesNotExist();
        _;
    }

    modifier onlyRecordOwner(bytes32 recordId) {
        if (_records[recordId].patient != msg.sender) revert NotRecordOwner();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Registration
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Register the caller as a Patient.
    function registerAsPatient() external {
        if (roles[msg.sender] != Role.None) revert AlreadyRegistered();
        roles[msg.sender] = Role.Patient;
        emit UserRegistered(msg.sender, Role.Patient);
    }

    /// @notice Register the caller as a Doctor.
    function registerAsDoctor() external {
        if (roles[msg.sender] != Role.None) revert AlreadyRegistered();
        roles[msg.sender] = Role.Doctor;
        emit UserRegistered(msg.sender, Role.Doctor);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record Management
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Upload a new encrypted medical record.
    /// @param ipfsCid  CID of the AES-256-GCM-encrypted file stored on IPFS.
    /// @param name     Human-readable label for this record.
    /// @return recordId Unique identifier for this record.
    function uploadRecord(string calldata ipfsCid, string calldata name)
        external
        onlyPatient
        returns (bytes32 recordId)
    {
        if (bytes(ipfsCid).length == 0) revert EmptyString();
        if (bytes(name).length == 0) revert EmptyString();

        uint256 nonce = _nonce[msg.sender]++;
        recordId = keccak256(abi.encodePacked(msg.sender, nonce, block.timestamp));

        _records[recordId] = Record({
            recordId:   recordId,
            patient:    msg.sender,
            ipfsCid:    ipfsCid,
            recordName: name,
            uploadedAt: block.timestamp,
            exists:     true
        });

        _patientRecords[msg.sender].push(recordId);

        emit RecordUploaded(recordId, msg.sender, block.timestamp);
    }

    /// @notice Get all record IDs for the calling patient.
    function getMyRecords() external view onlyPatient returns (bytes32[] memory) {
        return _patientRecords[msg.sender];
    }

    /// @notice Get record metadata (only owner or approved, unexpired doctor).
    function getRecord(bytes32 recordId)
        external
        view
        recordExists(recordId)
        returns (Record memory)
    {
        Record memory r = _records[recordId];
        // Owner always allowed
        if (r.patient == msg.sender) return r;
        // Doctor must have approved, unexpired access
        bytes32 key = _requestKey(recordId, msg.sender);
        AccessRequest memory req = _requests[key];
        if (req.status != AccessStatus.Approved) revert AccessNotApproved();
        if (req.expiresAt != 0 && block.timestamp > req.expiresAt) revert AccessExpired();
        return r;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Access Request Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Doctor requests access to a specific record.
    /// @param recordId  The target record.
    /// @param expiresAt Unix timestamp for expiry; 0 for no contract-level expiry.
    function requestAccess(bytes32 recordId, uint256 expiresAt)
        external
        onlyDoctor
        recordExists(recordId)
    {
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        bytes32 key = _requestKey(recordId, msg.sender);
        AccessRequest storage req = _requests[key];

        // Allow re-request only if previous was rejected/revoked
        if (
            req.status == AccessStatus.Pending ||
            req.status == AccessStatus.Approved
        ) revert RequestAlreadyExists();

        _requests[key] = AccessRequest({
            recordId:        recordId,
            doctor:          msg.sender,
            patient:         _records[recordId].patient,
            requestedAt:     block.timestamp,
            expiresAt:       expiresAt,
            status:          AccessStatus.Pending,
            encryptedKeyRef: ""
        });

        _doctorRequests[msg.sender].push(key);

        emit AccessRequested(recordId, msg.sender, block.timestamp);
    }

    /// @notice Patient approves a pending access request.
    /// @param recordId Target record (caller must be its owner).
    /// @param doctor   Doctor address to approve.
    /// @param encryptedKeyRef  Opaque reference handle — NOT the key itself.
    function approveAccess(
        bytes32 recordId,
        address doctor,
        string calldata encryptedKeyRef
    )
        external
        onlyPatient
        recordExists(recordId)
        onlyRecordOwner(recordId)
    {
        bytes32 key = _requestKey(recordId, doctor);
        AccessRequest storage req = _requests[key];
        if (req.status == AccessStatus.None) revert RequestDoesNotExist();
        if (req.status != AccessStatus.Pending) revert RequestNotPending();

        req.status          = AccessStatus.Approved;
        req.encryptedKeyRef = encryptedKeyRef;

        emit AccessApproved(recordId, doctor, req.expiresAt);
    }

    /// @notice Patient rejects a pending access request.
    function rejectAccess(bytes32 recordId, address doctor)
        external
        onlyPatient
        recordExists(recordId)
        onlyRecordOwner(recordId)
    {
        bytes32 key = _requestKey(recordId, doctor);
        AccessRequest storage req = _requests[key];
        if (req.status == AccessStatus.None) revert RequestDoesNotExist();
        if (req.status != AccessStatus.Pending) revert RequestNotPending();

        req.status = AccessStatus.Rejected;
        emit AccessRejected(recordId, doctor);
    }

    /// @notice Patient revokes a previously approved grant.
    function revokeAccess(bytes32 recordId, address doctor)
        external
        onlyPatient
        recordExists(recordId)
        onlyRecordOwner(recordId)
    {
        bytes32 key = _requestKey(recordId, doctor);
        AccessRequest storage req = _requests[key];
        if (req.status != AccessStatus.Approved) revert AccessNotApproved();

        req.status = AccessStatus.Revoked;
        emit AccessRevoked(recordId, doctor);
    }

    /// @notice Emit an on-chain access-log entry (called by doctor after decryption).
    ///         The contract verifies the caller has approved, unexpired access first.
    function logAccess(bytes32 recordId)
        external
        onlyDoctor
        recordExists(recordId)
    {
        bytes32 key = _requestKey(recordId, msg.sender);
        AccessRequest storage req = _requests[key];
        if (req.status != AccessStatus.Approved) revert AccessNotApproved();
        if (req.expiresAt != 0 && block.timestamp > req.expiresAt) revert AccessExpired();

        emit RecordAccessed(recordId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full AccessRequest struct for a (record, doctor) pair.
    function getAccessRequest(bytes32 recordId, address doctor)
        external
        view
        returns (AccessRequest memory)
    {
        return _requests[_requestKey(recordId, doctor)];
    }

    /// @notice Returns true if the doctor currently has approved, unexpired access.
    function hasActiveAccess(bytes32 recordId, address doctor)
        external
        view
        returns (bool)
    {
        bytes32 key = _requestKey(recordId, doctor);
        AccessRequest storage req = _requests[key];
        if (req.status != AccessStatus.Approved) return false;
        if (req.expiresAt != 0 && block.timestamp > req.expiresAt) return false;
        return true;
    }

    /// @notice Returns all request keys associated with a doctor.
    function getDoctorRequests(address doctor)
        external
        view
        returns (bytes32[] memory)
    {
        return _doctorRequests[doctor];
    }

    /// @notice Returns all record IDs for a given patient (callable by anyone
    ///         to allow doctor dashboards to list patient records by address).
    ///         The CIDs are encrypted, so this leaks only non-sensitive metadata.
    function getPatientRecords(address patient)
        external
        view
        returns (bytes32[] memory)
    {
        return _patientRecords[patient];
    }

    /// @notice Read a record's public metadata without access restriction.
    ///         Returns only recordId, patient, recordName, uploadedAt — NOT the CID.
    ///         The CID is gated behind getRecord() which enforces access control.
    function getRecordMeta(bytes32 recordId)
        external
        view
        recordExists(recordId)
        returns (
            bytes32 id,
            address patient,
            string memory recordName,
            uint256 uploadedAt
        )
    {
        Record storage r = _records[recordId];
        return (r.recordId, r.patient, r.recordName, r.uploadedAt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _requestKey(bytes32 recordId, address doctor)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(recordId, doctor));
    }
}
