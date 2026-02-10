import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = "https://cloudly-dj52.onrender.com/api";

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & Reset
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API}/auth/forgot-password`, { email });
            alert("OTP sent to your email!");
            setStep(2);
        } catch (err) {
            alert(err.response?.data?.error || "User not found or Server Error");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API}/auth/reset-password`, { email, otp, newPassword });
            alert("Password reset successful! Please login.");
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.error || "Invalid OTP or Session Expired");
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', padding: '20px' },
        card: { background: '#fff', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' },
        input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' },
        button: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={{ marginBottom: '10px' }}>{step === 1 ? "Forgot Password" : "Reset Password"}</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                    {step === 1 ? "Enter your email to receive a 6-digit code." : "Enter the OTP sent to your email and your new password."}
                </p>

                {step === 1 ? (
                    <form onSubmit={handleSendOTP}>
                        <input 
                            type="email" 
                            placeholder="Email address" 
                            style={styles.input} 
                            required 
                            onChange={(e) => setEmail(e.target.value)} 
                        />
                        <button type="submit" style={styles.button} disabled={loading}>
                            {loading ? "Sending..." : "Continue"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword}>
                        <input 
                            type="text" 
                            placeholder="6-Digit OTP" 
                            style={styles.input} 
                            required 
                            maxLength="6"
                            onChange={(e) => setOtp(e.target.value)} 
                        />
                        <input 
                            type="password" 
                            placeholder="New Password" 
                            style={styles.input} 
                            required 
                            onChange={(e) => setNewPassword(e.target.value)} 
                        />
                        <button type="submit" style={styles.button} disabled={loading}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                )}
                
                <p style={{ marginTop: '20px', fontSize: '14px' }}>
                    <span onClick={() => navigate('/')} style={{ color: '#1e40af', cursor: 'pointer' }}>Back to Login</span>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;