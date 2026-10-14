import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import { ROLE } from './services/web3';
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

function AppRoutes() {
  const { address, role } = useWallet();
  return (
    <Routes>
      <Route path="/" element={!address ? <LandingPage /> : role === ROLE.None ? <Navigate to="/register" /> : role === ROLE.Patient ? <Navigate to="/patient" /> : <Navigate to="/doctor" />} />
      <Route path="/register" element={address ? <RegisterPage /> : <Navigate to="/" />} />
      <Route path="/patient" element={role === ROLE.Patient ? <PatientLayout /> : <Navigate to="/" />}>
        <Route index element={<PatientOverview />} />
        <Route path="upload" element={<UploadRecord />} />
        <Route path="records" element={<MyRecords />} />
        <Route path="requests" element={<DoctorRequests />} />
        <Route path="approved" element={<ApprovedAccess />} />
        <Route path="history" element={<PatientHistory />} />
      </Route>
      <Route path="/doctor" element={role === ROLE.Doctor ? <DoctorLayout /> : <Navigate to="/" />}>
        <Route index element={<DoctorOverview />} />
        <Route path="search" element={<FindPatient />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="records" element={<ApprovedRecords />} />
        <Route path="history" element={<DoctorHistory />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
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
