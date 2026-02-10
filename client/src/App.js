// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import Auth from './components/Auth';
// import Drive from './components/Drive';
// import ForgotPassword from './ForgotPassword';
// // SDE Pattern: Only allows access to Drive if a token exists
// const ProtectedRoute = ({ children }) => {
//     const token = localStorage.getItem("token");
//     return token ? children : <Navigate to="/" />;
// };

// function App() {
//     return (
//         <Router>
//             <Routes>
//                 {/* Login/Signup Page */}
//                 <Route path="/" element={<Auth />} />

//                 {/* Secure Drive Page */}
//                 <Route 
//                     path="/drive" 
//                     element={
//                         <ProtectedRoute>
//                             <Drive />
//                         </ProtectedRoute>
//                     } 
//                 />

//                 {/* Redirect any unknown routes to Login */}
//                 <Route path="*" element={<Navigate to="/" />} />
//             </Routes>
//         </Router>
//     );
// }

// export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Drive from './components/Drive';
import ForgotPassword from './ForgotPassword';

// SDE Pattern: Only allows access to Drive if a token exists
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("token");
    return token ? children : <Navigate to="/" />;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Login/Signup Page */}
                <Route path="/" element={<Auth />} />

                {/* Forgot Password Page (Public) */}
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Secure Drive Page (Protected) */}
                <Route 
                    path="/drive" 
                    element={
                        <ProtectedRoute>
                            <Drive />
                        </ProtectedRoute>
                    } 
                />

                {/* Redirect any unknown routes to Login */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;