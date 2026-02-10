// 
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = "https://cloudly-dj52.onrender.com/api";

const ForgotPassword = () => {
    const [step, setStep] = useState(1); // 1 = Email, 2 = OTP/NewPass
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
            alert("Success! Check your email for the 6-digit code.");
            setStep(2);
        } catch (err) {
            alert(err.response?.data?.error || "Error sending OTP");
        } finally { setLoading(false); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API}/auth/reset-password`, { email, otp, newPassword });
            alert("Password changed! Please login now.");
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.error || "Invalid OTP");
        } finally { setLoading(false); }
    };

    const styles = {
        page: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f1f5f9' },
        card: { background: '#fff', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '380px', textAlign: 'center' },
        input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' },
        btn: { width: '100%', padding: '12px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2>{step === 1 ? "Recovery" : "New Password"}</h2>
                <p style={{fontSize: '14px', color: '#64748b', marginBottom: '20px'}}>
                    {step === 1 ? "Enter your email to receive an OTP." : "Enter the OTP from your email and your new password."}
                </p>

                {step === 1 ? (
                    <form onSubmit={handleSendOTP}>
                        <input type="email" placeholder="Email Address" style={styles.input} required onChange={e => setEmail(e.target.value)} />
                        <button type="submit" style={styles.btn} disabled={loading}>{loading ? "Sending..." : "Send Code"}</button>
                    </form>
                ) : (
                    <form onSubmit={handleReset}>
                        <input type="text" placeholder="6-Digit OTP" style={styles.input} required onChange={e => setOtp(e.target.value)} />
                        <input type="password" placeholder="New Password" style={styles.input} required onChange={e => setNewPassword(e.target.value)} />
                        <button type="submit" style={styles.btn} disabled={loading}>{loading ? "Updating..." : "Reset Password"}</button>
                    </form>
                )}
                <button onClick={() => navigate('/')} style={{marginTop: '20px', background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer'}}>Back to Login</button>
            </div>
        </div>
    );
};

export default ForgotPassword;