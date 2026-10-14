// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/MedChain.sol";

contract MedChainTest is Test {
    MedChain public medchain;

    address patient1 = makeAddr("patient1");
    address patient2 = makeAddr("patient2");
    address doctor1  = makeAddr("doctor1");
    address doctor2  = makeAddr("doctor2");
    address stranger = makeAddr("stranger");

    string constant CID1  = "QmTestCid1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    string constant CID2  = "QmTestCid2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    string constant NAME1 = "Blood Test Report";
    string constant NAME2 = "MRI Scan";
    string constant KEY_REF = "enc-key-handle-abc123";

    function setUp() public {
        medchain = new MedChain();

        vm.prank(patient1);
        medchain.registerAsPatient();

        vm.prank(patient2);
        medchain.registerAsPatient();

        vm.prank(doctor1);
        medchain.registerAsDoctor();

        vm.prank(doctor2);
        medchain.registerAsDoctor();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Registration
    // ─────────────────────────────────────────────────────────────────────────

    function test_RegisterPatient() public view {
        assertEq(uint(medchain.roles(patient1)), uint(MedChain.Role.Patient));
    }

    function test_RegisterDoctor() public view {
        assertEq(uint(medchain.roles(doctor1)), uint(MedChain.Role.Doctor));
    }

    function test_RegisterTwice_Reverts() public {
        vm.prank(patient1);
        vm.expectRevert(MedChain.AlreadyRegistered.selector);
        medchain.registerAsPatient();
    }

    function test_StrangerHasNoRole() public view {
        assertEq(uint(medchain.roles(stranger)), uint(MedChain.Role.None));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record Upload
    // ─────────────────────────────────────────────────────────────────────────

    function test_UploadRecord_Success() public {
        vm.prank(patient1);
        bytes32 rid = medchain.uploadRecord(CID1, NAME1);

        bytes32[] memory recs = _getMyRecords(patient1);
        assertEq(recs.length, 1);
        assertEq(recs[0], rid);
    }

    function test_UploadRecord_EmitEvent() public {
        vm.prank(patient1);
        // Check that recordId topic and patient topic are emitted; skip exact values
        vm.expectEmit(false, true, false, false);
        emit MedChain.RecordUploaded(bytes32(0), patient1, block.timestamp);
        medchain.uploadRecord(CID1, NAME1);
    }

    function test_UploadRecord_EmptyCID_Reverts() public {
        vm.prank(patient1);
        vm.expectRevert(MedChain.EmptyString.selector);
        medchain.uploadRecord("", NAME1);
    }

    function test_UploadRecord_EmptyName_Reverts() public {
        vm.prank(patient1);
        vm.expectRevert(MedChain.EmptyString.selector);
        medchain.uploadRecord(CID1, "");
    }

    function test_DoctorCannotUploadRecord() public {
        vm.prank(doctor1);
        vm.expectRevert(MedChain.NotPatient.selector);
        medchain.uploadRecord(CID1, NAME1);
    }

    function test_StrangerCannotUploadRecord() public {
        vm.prank(stranger);
        vm.expectRevert(MedChain.NotPatient.selector);
        medchain.uploadRecord(CID1, NAME1);
    }

    function test_UploadMultipleRecords() public {
        vm.startPrank(patient1);
        medchain.uploadRecord(CID1, NAME1);
        medchain.uploadRecord(CID2, NAME2);
        vm.stopPrank();

        bytes32[] memory recs = _getMyRecords(patient1);
        assertEq(recs.length, 2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record Access (owner)
    // ─────────────────────────────────────────────────────────────────────────

    function test_PatientCanGetOwnRecord() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(patient1);
        MedChain.Record memory r = medchain.getRecord(rid);
        assertEq(r.patient, patient1);
        assertEq(r.ipfsCid, CID1);
    }

    function test_StrangerCannotGetRecord() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(stranger);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.getRecord(rid);
    }

    function test_UnapprovedDoctorCannotGetRecord() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.getRecord(rid);
    }

    function test_GetNonexistentRecord_Reverts() public {
        vm.prank(patient1);
        vm.expectRevert(MedChain.RecordDoesNotExist.selector);
        medchain.getRecord(bytes32(uint256(999)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Access Request
    // ─────────────────────────────────────────────────────────────────────────

    function test_DoctorRequestAccess_Success() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Pending));
        assertEq(req.doctor, doctor1);
    }

    function test_RequestAccess_EmitEvent() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(doctor1);
        vm.expectEmit(true, true, false, false);
        emit MedChain.AccessRequested(rid, doctor1, block.timestamp);
        medchain.requestAccess(rid, 0);
    }

    function test_PatientCannotRequestAccess() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(patient2);
        vm.expectRevert(MedChain.NotDoctor.selector);
        medchain.requestAccess(rid, 0);
    }

    function test_DuplicateRequest_Reverts() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);

        vm.prank(doctor1);
        vm.expectRevert(MedChain.RequestAlreadyExists.selector);
        medchain.requestAccess(rid, 0);
    }

    function test_RequestOnNonExistentRecord_Reverts() public {
        vm.prank(doctor1);
        vm.expectRevert(MedChain.RecordDoesNotExist.selector);
        medchain.requestAccess(bytes32(uint256(999)), 0);
    }

    function test_RequestWithPastExpiry_Reverts() public {
        bytes32 rid = _uploadAsPatient1();

        // Advance time so block.timestamp > 0 and we can set a past expiry
        vm.warp(block.timestamp + 100);

        vm.prank(doctor1);
        vm.expectRevert(MedChain.InvalidExpiry.selector);
        medchain.requestAccess(rid, block.timestamp - 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Approve
    // ─────────────────────────────────────────────────────────────────────────

    function test_ApproveAccess_Success() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Approved));
        assertEq(req.encryptedKeyRef, KEY_REF);
    }

    function test_ApprovedDoctorCanGetRecord() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(doctor1);
        MedChain.Record memory r = medchain.getRecord(rid);
        assertEq(r.ipfsCid, CID1);
    }

    function test_ApproveEmitEvent() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        vm.expectEmit(true, true, false, false);
        emit MedChain.AccessApproved(rid, doctor1, 0);
        medchain.approveAccess(rid, doctor1, KEY_REF);
    }

    function test_NonOwnerCannotApprove() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient2);
        vm.expectRevert(MedChain.NotRecordOwner.selector);
        medchain.approveAccess(rid, doctor1, KEY_REF);
    }

    function test_ApproveNonExistentRequest_Reverts() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(patient1);
        vm.expectRevert(MedChain.RequestDoesNotExist.selector);
        medchain.approveAccess(rid, doctor1, KEY_REF);
    }

    function test_HasActiveAccess_AfterApproval() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        assertTrue(medchain.hasActiveAccess(rid, doctor1));
        assertFalse(medchain.hasActiveAccess(rid, doctor2));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Reject
    // ─────────────────────────────────────────────────────────────────────────

    function test_RejectAccess_Success() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.rejectAccess(rid, doctor1);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Rejected));
    }

    function test_RejectedDoctorCannotGetRecord() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.rejectAccess(rid, doctor1);

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.getRecord(rid);
    }

    function test_RejectedDoctorCanReRequest() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.rejectAccess(rid, doctor1);

        // doctor can request again after rejection
        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Pending));
    }

    function test_NonOwnerCannotReject() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient2);
        vm.expectRevert(MedChain.NotRecordOwner.selector);
        medchain.rejectAccess(rid, doctor1);
    }

    function test_RejectAlreadyApproved_Reverts() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(patient1);
        vm.expectRevert(MedChain.RequestNotPending.selector);
        medchain.rejectAccess(rid, doctor1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revoke
    // ─────────────────────────────────────────────────────────────────────────

    function test_RevokeAccess_Success() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(patient1);
        medchain.revokeAccess(rid, doctor1);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Revoked));
    }

    function test_RevokedDoctorCannotGetRecord() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(patient1);
        medchain.revokeAccess(rid, doctor1);

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.getRecord(rid);
    }

    function test_HasActiveAccess_AfterRevoke() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);
        assertTrue(medchain.hasActiveAccess(rid, doctor1));

        vm.prank(patient1);
        medchain.revokeAccess(rid, doctor1);
        assertFalse(medchain.hasActiveAccess(rid, doctor1));
    }

    function test_RevokeNotApproved_Reverts() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.revokeAccess(rid, doctor1);
    }

    function test_NonOwnerCannotRevoke() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(patient2);
        vm.expectRevert(MedChain.NotRecordOwner.selector);
        medchain.revokeAccess(rid, doctor1);
    }

    function test_RevokedDoctorCanReRequest() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(patient1);
        medchain.revokeAccess(rid, doctor1);

        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);

        MedChain.AccessRequest memory req = medchain.getAccessRequest(rid, doctor1);
        assertEq(uint(req.status), uint(MedChain.AccessStatus.Pending));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Expiry
    // ─────────────────────────────────────────────────────────────────────────

    function test_ExpiredAccessDenied() public {
        bytes32 rid = _uploadAsPatient1();

        uint256 expiry = block.timestamp + 100;

        vm.prank(doctor1);
        medchain.requestAccess(rid, expiry);

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        // Before expiry — access granted
        assertTrue(medchain.hasActiveAccess(rid, doctor1));

        // Warp past expiry
        vm.warp(expiry + 1);

        assertFalse(medchain.hasActiveAccess(rid, doctor1));

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessExpired.selector);
        medchain.getRecord(rid);
    }

    function test_LogAccess_Success() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.prank(doctor1);
        vm.expectEmit(true, true, false, false);
        emit MedChain.RecordAccessed(rid, doctor1, block.timestamp);
        medchain.logAccess(rid);
    }

    function test_LogAccess_Unapproved_Reverts() public {
        bytes32 rid = _uploadAndRequest();

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessNotApproved.selector);
        medchain.logAccess(rid);
    }

    function test_LogAccess_Expired_Reverts() public {
        bytes32 rid = _uploadAsPatient1();
        uint256 expiry = block.timestamp + 50;

        vm.prank(doctor1);
        medchain.requestAccess(rid, expiry);

        vm.prank(patient1);
        medchain.approveAccess(rid, doctor1, KEY_REF);

        vm.warp(expiry + 1);

        vm.prank(doctor1);
        vm.expectRevert(MedChain.AccessExpired.selector);
        medchain.logAccess(rid);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Meta / View
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetRecordMeta_AnyoneCanRead() public {
        bytes32 rid = _uploadAsPatient1();

        (bytes32 id, address p, string memory name, uint256 ts) =
            medchain.getRecordMeta(rid);

        assertEq(id, rid);
        assertEq(p, patient1);
        assertEq(name, NAME1);
        assertGt(ts, 0);
    }

    function test_GetPatientRecords_AnyoneCanRead() public {
        _uploadAsPatient1();

        vm.prank(doctor1);
        bytes32[] memory recs = medchain.getPatientRecords(patient1);
        assertEq(recs.length, 1);
    }

    function test_GetDoctorRequests() public {
        bytes32 rid = _uploadAsPatient1();

        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);

        bytes32[] memory keys = medchain.getDoctorRequests(doctor1);
        assertEq(keys.length, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_UploadRecordUniqueIds(uint8 count) public {
        vm.assume(count > 0 && count <= 50);
        vm.startPrank(patient1);
        bytes32[] memory ids = new bytes32[](count);
        for (uint8 i = 0; i < count; i++) {
            ids[i] = medchain.uploadRecord(CID1, NAME1);
            if (i > 0) {
                assertTrue(ids[i] != ids[i - 1], "Duplicate recordId");
            }
            // advance block so timestamp differs
            vm.warp(block.timestamp + 1);
        }
        vm.stopPrank();

        bytes32[] memory stored = _getMyRecords(patient1);
        assertEq(stored.length, count);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _getMyRecords(address patient) internal returns (bytes32[] memory) {
        vm.prank(patient);
        return medchain.getMyRecords();
    }

    function _uploadAsPatient1() internal returns (bytes32 rid) {
        vm.prank(patient1);
        rid = medchain.uploadRecord(CID1, NAME1);
    }

    function _uploadAndRequest() internal returns (bytes32 rid) {
        rid = _uploadAsPatient1();
        vm.prank(doctor1);
        medchain.requestAccess(rid, 0);
    }
}
