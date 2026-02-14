import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Drive from './components/Drive';

// SDE Pattern: Only allows access to Drive if a token exists
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("token");
    return token ? children : <Navigate to="/" />;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* 1. Login/Signup Page */}
                <Route path="/" element={<Auth />} />

                {/* 2. Secure Drive Page (Requires Login) */}
                <Route 
                    path="/drive" 
                    element={
                        <ProtectedRoute>
                            <Drive />
                        </ProtectedRoute>
                    } 
                />

                {/* 3. Redirect any unknown routes to Login */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;