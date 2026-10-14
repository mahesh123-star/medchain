# MedChain: Secure and Smart Medical Record Sharing Using Blockchain, IPFS, and AI

> **Final-Year Engineering Project**  
> Academic Prototype — Built with Solidity (Foundry), React.js (Vite + Tailwind CSS), IPFS (Pinata), and FastAPI (AES-256-GCM + AI Summarization).

---

## 1. Project Overview

**MedChain** is a patient-centric, decentralized medical record management and sharing platform. Patients maintain cryptographic and smart contract ownership of their medical records. Doctors must submit explicit on-chain access requests, which patients can approve, reject, or revoke at any time.

### Core Architecture Principles:
- **No Medical Data On-Chain:** Smart contracts store strictly metadata (unique Record ID, patient address, IPFS CID, timestamps). No protected health information (PHI) or secret keys touch the blockchain.
- **Client-Side AES-256-GCM Encryption:** Medical documents (PDFs) are encrypted in the patient's browser using the Web Crypto API *before* uploading to IPFS.
- **Access-Controlled IPFS Storage:** Only encrypted ciphertext is pinned to IPFS via Pinata.
- **Consent-Driven Key Delivery:** Doctors cannot decrypt records simply by knowing the IPFS CID. Decryption keys are managed through an authenticated key-delivery service bound to on-chain approval status.
- **Integrated AI Summarization:** Authorized doctors can request instant, structured AI medical summaries of decrypted reports with clinical disclaimers.
- **Tamper-Proof Audit Trail:** Record uploads, access requests, approvals, rejections, revocations, and document access events are immutably emitted on-chain.

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Smart Contracts** | Solidity `^0.8.24`, Foundry (`forge`, `anvil`, `cast`), OpenZeppelin patterns |
| **Blockchain Client** | Ethers.js `v6`, MetaMask |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Lucide React, React Hot Toast |
| **Storage & Security** | IPFS (Pinata REST API), AES-256-GCM (Web Crypto API + Cryptography AEAD) |
| **Backend API** | Python 3.11, FastAPI, Uvicorn, HTTPX, Pydantic |
| **AI Service** | FastAPI, PyPDF, OpenAI / Gemini API (with Local Extractive Summarizer fallback) |

---

## 3. Directory Structure

```
MedChain/
├── contracts/
│   └── MedChain.sol              # Core smart contract
├── test/
│   └── MedChain.t.sol            # 46 Foundry unit & fuzz tests
├── script/
│   └── Deploy.s.sol              # Foundry deployment script
├── frontend/
│   ├── src/
│   │   ├── components/           # Sidebar, StatusBadge, ConfirmDialog, Spinner
│   │   ├── context/              # WalletContext (MetaMask integration)
│   │   ├── contracts/            # MedChainABI.js & contract definitions
│   │   ├── pages/
│   │   │   ├── patient/          # Overview, UploadRecord, MyRecords, Requests, Approved, History
│   │   │   ├── doctor/           # Overview, FindPatient, MyRequests, ApprovedRecords, History
│   │   │   ├── LandingPage.jsx   # Public landing page
│   │   │   └── RegisterPage.jsx  # Role registration (Patient vs Doctor)
│   │   ├── services/             # web3.js, crypto.js (AES-GCM), api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── backend/
│   ├── routers/
│   │   ├── ipfs.py               # Pinata IPFS upload/retrieval + local offline fallback
│   │   └── keys.py               # Key wrapping & consent-based delivery
│   ├── main.py                   # FastAPI server entrypoint (:8000)
│   └── requirements.txt
├── ai-service/
│   ├── main.py                   # AI service entrypoint (:8001)
│   ├── summarizer.py             # LLM provider + extractive clinical fallback
│   └── requirements.txt
├── sample_records/               # Synthetic clinical test records (PDFs)
│   ├── generate_samples.py       # Generator script for test PDF reports
│   ├── sample_blood_test.pdf
│   ├── sample_cardiology_consult.pdf
│   └── sample_mri_report.pdf
├── run_anvil.bat                 # Convenience launcher: Local node
├── deploy_local.bat              # Convenience launcher: Contract deployer
├── run_backend.bat               # Convenience launcher: Backend (:8000)
├── run_ai_service.bat            # Convenience launcher: AI service (:8001)
├── run_frontend.bat              # Convenience launcher: React app (:5173)
├── test_all.bat                  # Runs full automated test suite
├── foundry.toml                  # Foundry project configuration
├── .env.example                  # Template configuration without secrets
└── .gitignore                    # Protects API keys, node_modules, and cache
```

---

## 4. Smart Contract Architecture

The smart contract [`contracts/MedChain.sol`](contracts/MedChain.sol) implements strict role-based access control and lifecycle states:

### Data Structures & State Machine
- **Roles:** `None (0)`, `Patient (1)`, `Doctor (2)`
- **AccessStatus:** `None (0)`, `Pending (1)`, `Approved (2)`, `Rejected (3)`, `Revoked (4)`
- **Record Mapping:** `recordId => Record(bytes32, patient, ipfsCid, recordName, uploadedAt, exists)`
- **Request Mapping:** `keccak256(recordId, doctor) => AccessRequest`

### Key Functions
- `registerAsPatient()`, `registerAsDoctor()`: Permanent role binding.
- `uploadRecord(ipfsCid, name)`: Patient registers an encrypted IPFS CID and generates a unique `recordId`.
- `getRecord(recordId)`: Access-controlled retrieval. Only the record owner or an approved, unexpired doctor can view the IPFS CID.
- `requestAccess(recordId, expiresAt)`: Doctor submits an access request.
- `approveAccess(recordId, doctor, encryptedKeyRef)`: Patient approves access.
- `rejectAccess(recordId, doctor)`: Patient rejects request.
- `revokeAccess(recordId, doctor)`: Patient revokes previously granted access.
- `logAccess(recordId)`: Doctor logs verified access to the blockchain audit trail upon decryption.
- `hasActiveAccess(recordId, doctor)`: Checks if a doctor currently holds valid, unexpired access.

---

## 5. Security & Cryptographic Workflow

```
[Patient Browser]
       │
       ├─ 1. Selects PDF
       ├─ 2. Generates random AES-256-GCM Key + 12-byte IV (Web Crypto API)
       ├─ 3. Encrypts PDF in browser (Ciphertext bytes)
       │
       ├──> POST /ipfs/upload ──> Pinata (Only Ciphertext pinned) ──> IPFS CID
       │
       ├──> POST /keys/store ───> Backend wraps key with Server Master Secret
       │
       └──> uploadRecord(CID) ──> Ethereum Contract (Records ownership & metadata)

[Doctor Access Workflow]
       │
       ├─ 1. requestAccess(recordId) on Ethereum
       ├─ 2. Patient calls approveAccess(recordId, doctor) & POST /keys/grant
       │
       ├─ 3. Doctor calls getRecord(recordId) on-chain (Verified: Approved & Not Expired)
       ├─ 4. Doctor fetches encrypted bytes from IPFS via CID
       ├─ 5. Doctor calls POST /keys/retrieve with doctor address (Granted key returned)
       ├─ 6. Doctor decrypts PDF using Web Crypto API in browser
       ├─ 7. Doctor calls logAccess(recordId) emitting RecordAccessed event
       │
       └──> (Optional) POST /summarize to AI Service with decrypted text
```

---

## 6. Installation & Quickstart

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+
- Foundry (`forge`, `anvil`, `cast`)
- MetaMask browser extension

### Step 1: Install Dependencies
```bash
# Frontend
cd frontend
npm install
cd ..

# Backend & AI Service
pip install -r backend/requirements.txt
pip install -r ai-service/requirements.txt
```

### Step 2: Environment Configuration
Copy `.env.example` to the required locations:
```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```
*(Defaults in `.env.local` are already configured for local Anvil development.)*

---

## 7. Running Locally (Step-by-Step)

### Option A: Using Batch Launchers (Windows)
Open 4 terminal windows and run:
1. `run_anvil.bat` (Starts local node at `http://127.0.0.1:8545`)
2. `deploy_local.bat` (Deploys contract to Anvil: `0x5FbDB2315678afecb367f032d93F642f64180aa3`)
3. `run_backend.bat` (Starts backend at `http://127.0.0.1:8000`)
4. `run_ai_service.bat` (Starts AI summarizer at `http://127.0.0.1:8001`)
5. `run_frontend.bat` (Starts Vite dev server at `http://localhost:5173`)

### Option B: Manual Command Line
```bash
# Terminal 1: Anvil
anvil --chain-id 31337 --port 8545

# Terminal 2: Deploy Contract
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3: Backend
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 4: AI Service
cd ai-service
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 5: Frontend
cd frontend
npm run dev
```

---

## 8. Optional: Ethereum Sepolia Deployment

To deploy MedChain to Ethereum Sepolia testnet:

1. Obtain testnet ETH from a Sepolia faucet.
2. In your root directory, run:
```bash
forge script script/Deploy.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast \
  --private-key YOUR_SEPOLIA_PRIVATE_KEY
```
3. Update `frontend/.env.local`:
```env
VITE_CONTRACT_ADDRESS=<Deployed_Sepolia_Address>
VITE_CHAIN_ID=11155111
```
4. Rebuild/refresh the frontend. MetaMask will automatically prompt to switch to the Sepolia network.

---

## 9. Comprehensive Testing

Run the automated test suite covering all 3 layers:
```bash
# Run all tests (Foundry + Backend + AI Service)
.\test_all.bat
```

### Foundry Smart Contract Test Suite
```bash
forge test -vv
```
**Results: 46 / 46 Passed (100% Success Rate)**
- `test_RegisterPatient` & `test_RegisterDoctor`: Role binding tests
- `test_RegisterTwice_Reverts`: Prevents duplicate registration
- `test_UploadRecord_Success`: Validates unique record IDs & metadata
- `test_UploadRecord_EmptyCID_Reverts` & `EmptyName_Reverts`: Input validation
- `test_DoctorCannotUploadRecord`: Unauthorized role rejection
- `test_PatientCanGetOwnRecord`: Owner access validation
- `test_UnapprovedDoctorCannotGetRecord`: Cryptographic access gate enforcement
- `test_DoctorRequestAccess_Success` & `test_DuplicateRequest_Reverts`: Lifecycle verification
- `test_ApproveAccess_Success` & `test_NonOwnerCannotApprove`: Owner authorization
- `test_RejectAccess_Success` & `test_RevokeAccess_Success`: Access revocation
- `test_ExpiredAccessDenied`: Timestamp expiry verification
- `test_LogAccess_Success` & `test_LogAccess_Expired_Reverts`: Audit logging
- `testFuzz_UploadRecordUniqueIds`: Fuzz testing for 256 iterations ensuring collision-free IDs

---

## 10. End-to-End Demonstration Guide

Follow this guide to demonstrate the complete workflow:

### Setup Two Test Wallets in MetaMask
Import Anvil test accounts using their private keys:
- **Patient Account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`  
  Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Doctor Account:** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`  
  Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

### Workflow Steps:
1. **Connect Patient:** Open `http://localhost:5173`. Connect MetaMask with Account 0. Register as **Patient**.
2. **Upload Medical Record:** Navigate to **Upload Record**. Drag & drop `sample_records/sample_blood_test.pdf`. Click **Encrypt and Upload**.
   - Notice the browser generates an AES-256 key, encrypts the file, posts ciphertext to IPFS, and signs the transaction on Anvil.
3. **Switch to Doctor:** In MetaMask, switch to Account 1. Connect and register as **Doctor**.
4. **Find Patient & Request Access:** Go to **Find Patient**. Enter the patient's address (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`). Click **Search**, then click **Request Access**. Sign the transaction.
5. **Patient Approval:** Switch MetaMask back to Account 0 (Patient). Go to **Doctor Requests**. Review the pending request and click **Approve**. Confirm the modal and sign the transaction.
6. **Doctor Retrieval & Decryption:** Switch back to Account 1 (Doctor). Go to **Approved Records**.
   - Click **Open**: The record is retrieved from IPFS, decrypted in the browser using the granted key, verified on-chain, and downloaded as a PDF.
   - Click **AI Summary**: The decrypted report text is processed by the AI service, returning a structured clinical breakdown.
7. **Patient Revocation:** Switch to Account 0 (Patient). Go to **Approved Access** and click **Revoke**.
8. **Verify Revocation:** Switch back to Account 1 (Doctor). Refresh **Approved Records**. The status changes to *Revoked*, and access is blocked.
9. **Audit Trail:** Check **Audit Trail** in both dashboards to see every on-chain event (`RecordUploaded`, `AccessRequested`, `AccessApproved`, `RecordAccessed`, `AccessRevoked`).

---

## 11. Security Architecture & Known Limitations

### Security Safeguards Implemented
- **Confidentiality:** Encryption keys and medical file contents are never written to the blockchain, events, or public IPFS objects.
- **Client-Side Cryptography:** Decryption occurs strictly on authorized clients. The server never observes unencrypted PDFs.
- **On-Chain Enforcement:** The contract strictly validates ownership before approving or revoking access.

### Honest Limitations of the Prototype
- **Client-Side Information Duplication:** Once an authorized doctor decrypts and downloads a medical record, smart contracts cannot prevent the doctor from saving, copying, or forwarding the plaintext file locally.
- **Key Management Scaling:** In this academic prototype, key delivery is authenticated by address-bound grants. A production healthcare system would implement asymmetric ECIES (Elliptic Curve Integrated Encryption Scheme) using doctors' public keys or threshold cryptography (MPC/HSM).
- **Emergency Access (Break-Glass):** Deliberately excluded from this prototype to prevent backdoors that bypass explicit patient consent.

---

## 12. License
Academic MIT License. Created for final-year engineering evaluation and research.
