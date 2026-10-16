import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import { ROLE } from './services/web3';
import Spinner from './components/Spinner';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import PatientLayout from './pages/patient/PatientLayout';
import PatientOverview from './pages/patient/PatientOverview';
import UploadRecord from './pages/patient/UploadRecord';
import MyRecords from './pages/patient/MyRecords';
import DoctorRequests from './pages/patient/DoctorRequests';
import ApprovedAccess from './pages/patient/ApprovedAccess';
import PatientHistory from './pages/patient/PatientHistory';
import DoctorLayout from './pages/doctor/DoctorLayout';
import DoctorOverview from './pages/doctor/DoctorOverview';
import FindPatient from './pages/doctor/FindPatient';
import MyRequests from './pages/doctor/MyRequests';
import ApprovedRecords from './pages/doctor/ApprovedRecords';
import DoctorHistory from './pages/doctor/DoctorHistory';
import SystemLogs from './pages/SystemLogs';

function AppRoutes() {
  const { address, role, isInitializing } = useWallet();

  // Prevent routing redirects while checking if MetaMask was already connected
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm font-medium text-slate-600">Restoring MedChain session...</p>
        <p className="text-xs text-slate-400 mt-1">Connecting to MetaMask and verifying role</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root Route */}
      <Route
        path="/"
        element={
          !address ? (
            <LandingPage />
          ) : role === ROLE.None ? (
            <Navigate to="/register" replace />
          ) : role === ROLE.Patient ? (
            <Navigate to="/patient" replace />
          ) : (
            <Navigate to="/doctor" replace />
          )
        }
      />

      {/* Register Route: Only accessible if connected with no role */}
      <Route
        path="/register"
        element={
          !address ? (
            <Navigate to="/" replace />
          ) : role === ROLE.Patient ? (
            <Navigate to="/patient" replace />
          ) : role === ROLE.Doctor ? (
            <Navigate to="/doctor" replace />
          ) : (
            <RegisterPage />
          )
        }
      />

      {/* Patient Routes */}
      <Route
        path="/patient"
        element={
          !address ? (
            <Navigate to="/" replace />
          ) : role === ROLE.Doctor ? (
            <Navigate to="/doctor" replace />
          ) : role === ROLE.None ? (
            <Navigate to="/register" replace />
          ) : (
            <PatientLayout />
          )
        }
      >
        <Route index element={<PatientOverview />} />
        <Route path="upload" element={<UploadRecord />} />
        <Route path="records" element={<MyRecords />} />
        <Route path="requests" element={<DoctorRequests />} />
        <Route path="approved" element={<ApprovedAccess />} />
        <Route path="history" element={<PatientHistory />} />
        <Route path="logs" element={<SystemLogs />} />
      </Route>

      {/* Doctor Routes */}
      <Route
        path="/doctor"
        element={
          !address ? (
            <Navigate to="/" replace />
          ) : role === ROLE.Patient ? (
            <Navigate to="/patient" replace />
          ) : role === ROLE.None ? (
            <Navigate to="/register" replace />
          ) : (
            <DoctorLayout />
          )
        }
      >
        <Route index element={<DoctorOverview />} />
        <Route path="search" element={<FindPatient />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="records" element={<ApprovedRecords />} />
        <Route path="history" element={<DoctorHistory />} />
        <Route path="logs" element={<SystemLogs />} />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppRoutes />
    </WalletProvider>
  );
}
