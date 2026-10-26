import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import AdvisorDashboard from './pages/AdvisorDashboard';
import HodDashboard from './pages/HodDashboard';
import StaffDashboard from './pages/StaffDashboard';
import React from 'react';

// A simple wrapper to protect routes if needed
const ProtectedRoute = ({ children, allowedRole }) => {
    const token = localStorage.getItem('token');
    const role = (localStorage.getItem('role') || '').toUpperCase();

    if (!token) return <Navigate to="/login" replace />;
    if (allowedRole) {
        const allowed = Array.isArray(allowedRole)
            ? allowedRole.map(r => String(r).toUpperCase()).includes(role)
            : role === String(allowedRole).toUpperCase();
        if (!allowed) return <Navigate to="/login" replace />;
    }

    return children;
};

import DeoDashboard from './pages/DeoDashboard';
import SaDashboard from './pages/SaDashboard';
import SubjectStaffDashboard from './pages/SubjectStaffDashboard';
import ContextSelector from './components/ContextSelector';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />

                <Route path="/student/*" element={
                    <ProtectedRoute allowedRole="STUDENT">
                        <StudentDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/sa/*" element={<ProtectedRoute allowedRole="SA"><SaDashboard /></ProtectedRoute>} />
                <Route path="/deo/*" element={<ProtectedRoute allowedRole="DEO"><DeoDashboard /></ProtectedRoute>} />
                <Route path="/advisor/*" element={<ProtectedRoute allowedRole="ADVISOR"><AdvisorDashboard /></ProtectedRoute>} />
                <Route path="/hod/*" element={<ProtectedRoute allowedRole="HOD"><HodDashboard /></ProtectedRoute>} />
                <Route path="/staff/*" element={<ProtectedRoute allowedRole={['STAFF', 'FACULTY', 'ADVISOR', 'HOD', 'SUBJECT_STAFF']}><SubjectStaffDashboard /></ProtectedRoute>} />
                <Route path="/subject-staff/*" element={<ProtectedRoute allowedRole={['SUBJECT_STAFF', 'STAFF', 'FACULTY', 'ADVISOR', 'HOD']}><SubjectStaffDashboard /></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
