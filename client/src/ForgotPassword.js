import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = "https://cloudly-dj52.onrender.com/api";

const ForgotPassword = () => {
    const [step, setStep] = useState(1); 
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
            alert("Success! Check your email for the code.");
            setStep(2);
        } catch (err) {
            alert(err.response?.data?.error || "User not found");
        } finally { setLoading(false); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API}/auth/reset-password`, { email, otp, newPassword });
            alert("Password updated! Please login.");
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.error || "Invalid code");
        } finally { setLoading(false); }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={{color:'#3b82f6'}}>{step === 1 ? "Recover Password" : "Reset Password"}</h2>
                {step === 1 ? (
                    <form onSubmit={handleSendOTP}>
                        <input type="email" placeholder="Email" style={styles.input} required onChange={e => setEmail(e.target.value)} />
                        <button type="submit" style={styles.btn} disabled={loading}>{loading ? "Sending..." : "Send OTP"}</button>
                    </form>
                ) : (
                    <form onSubmit={handleReset}>
                        <input type="text" placeholder="6-Digit OTP" style={styles.input} required onChange={e => setOtp(e.target.value)} />
                        <input type="password" placeholder="New Password" style={styles.input} required onChange={e => setNewPassword(e.target.value)} />
                        <button type="submit" style={styles.btn} disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
                    </form>
                )}
                <p onClick={() => navigate('/')} style={{marginTop:20, color:'#3b82f6', cursor:'pointer', fontSize:14}}>Back to Login</p>
            </div>
        </div>
    );
};

const styles = {
    page: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' },
    card: { background: '#fff', padding: 40, borderRadius: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: 380, textAlign: 'center' },
    input: { width: '100%', padding: 12, margin: '10px 0', borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none', boxSizing:'border-box' },
    btn: { width: '100%', padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold', marginTop: 10 }
};

export default ForgotPassword;