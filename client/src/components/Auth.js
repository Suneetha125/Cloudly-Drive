import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

// YOUR DEPLOYED BACKEND URL
const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    // --- THESE STATES FIX THE "NOT DEFINED" ERROR ---
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot', 'reset'
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', otp: '', newPassword: '' });
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'signup') {
                await axios.post(`${API}/auth/register`, form);
                alert("Account created! Please login.");
                setMode('login');
            } 
            else if (mode === 'forgot') {
                const res = await axios.post(`${API}/auth/forgot-password`, { email: form.email });
                alert("OTP Sent! Check your email (or use 123456 for exam).");
                setMode('reset');
            } 
            else if (mode === 'reset') {
                await axios.post(`${API}/auth/reset-password`, { 
                    email: form.email, 
                    otp: form.otp, 
                    newPassword: form.password 
                });
                alert("Password updated!");
                setMode('login');
            } 
            else {
                // LOGIN MODE
                const res = await axios.post(`${API}/auth/login`, {
                    email: form.email.toLowerCase().trim(),
                    password: form.password
                });
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) {
            console.error("Auth Error:", err.response?.data);
            alert(err.response?.data?.error || "Action failed. Check your connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={{textAlign:'center', marginBottom:30}}>
                    <HardDrive size={50} color="#3b82f6" />
                    <h2 style={{marginTop:10, color: '#1e293b'}}>
                        {mode === 'login' ? 'Login to Cloudly' : 
                         mode === 'signup' ? 'Create Account' : 
                         mode === 'forgot' ? 'Recover Password' : 'Reset Password'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {/* Name Field (Signup only) */}
                    {mode === 'signup' && (
                        <div style={styles.inputGroup}>
                            <User size={18} color="#94a3b8"/>
                            <input style={styles.input} placeholder="Full Name" onChange={e=>setForm({...form, name: e.target.value})} required />
                        </div>
                    )}

                    {/* Email Field (Login, Signup, Forgot) */}
                    {(mode !== 'reset') && (
                        <div style={styles.inputGroup}>
                            <Mail size={18} color="#94a3b8"/>
                            <input style={styles.input} type="email" placeholder="Email Address" onChange={e=>setForm({...form, email: e.target.value})} required />
                        </div>
                    )}

                    {/* OTP Field (Reset only) */}
                    {mode === 'reset' && (
                        <input style={styles.inputFull} placeholder="6-Digit OTP" onChange={e=>setForm({...form, otp: e.target.value})} required />
                    )}

                    {/* Password Field (Login, Signup, Reset) */}
                    {mode !== 'forgot' && (
                        <div style={styles.inputGroup}>
                            <Lock size={18} color="#94a3b8"/>
                            <input 
                                style={styles.input} 
                                type={showPassword ? "text" : "password"} 
                                placeholder={mode === 'reset' ? "New Password" : "Password"} 
                                onChange={e=>setForm({...form, password: e.target.value})} 
                                required 
                            />
                            <div onClick={()=>setShowPassword(!showPassword)} style={{cursor:'pointer'}}>
                                {showPassword ? <EyeOff size={18} color="#94a3b8"/> : <Eye size={18} color="#94a3b8"/>}
                            </div>
                        </div>
                    )}

                    <button style={styles.btn} type="submit" disabled={loading}>
                        {loading ? "Please wait..." : 
                         mode === 'login' ? 'Sign In' : 
                         mode === 'signup' ? 'Get Started' : 'Continue'}
                    </button>

                    {/* Footer Links */}
                    <div style={{textAlign:'center', marginTop: 10}}>
                        {mode === 'login' && (
                            <p onClick={() => setMode('forgot')} style={styles.link}>Forgot Password?</p>
                        )}
                        
                        <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.toggleText}>
                            {mode === 'login' ? "Need an account? Sign up" : "Already have an account? Login"}
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', fontFamily: 'Inter, sans-serif' },
    card: { background: '#fff', padding: 40, borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: 400 },
    inputGroup: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' },
    input: { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 15 },
    inputFull: { padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9', outline: 'none', width: '100%', boxSizing: 'border-box' },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
    link: { color: '#64748b', fontSize: 13, cursor: 'pointer', marginBottom: 10 },
    toggleText: { cursor: 'pointer', color: '#3b82f6', textAlign: 'center', fontSize: 14, fontWeight: '500' }
};

export default Auth;