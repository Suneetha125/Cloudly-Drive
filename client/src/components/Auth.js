// Auth.js (UPDATED)
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [mode, setMode] = useState('login'); // login, signup, forgot, reset
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', otp: '', newPassword: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (mode === 'signup') {
                const res = await axios.post(`${API}/auth/register`, { name: form.name, email: form.email, password: form.password });
                alert(res.data.message || "Registration successful!");
                // Auto-login after successful registration as per backend change
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            } else if (mode === 'forgot') {
                const res = await axios.post(`${API}/auth/forgot-password`, { email: form.email });
                alert(res.data.message || "Recovery OTP Sent!"); 
                setMode('reset'); // Move to reset mode after sending OTP
            } else if (mode === 'reset') {
                const res = await axios.post(`${API}/auth/reset-password`, { email: form.email, otp: form.otp, newPassword: form.password });
                alert(res.data.message || "Password Reset Successful!"); 
                setMode('login'); // Go back to login after reset
            } else { // mode === 'login'
                const res = await axios.post(`${API}/auth/login`, { email: form.email, password: form.password });
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) { 
            console.error("Auth error:", err.response?.data || err);
            alert(err.response?.data?.error || "An unexpected error occurred."); 
        }
    };

    // Helper to switch between auth modes
    const switchTo = (newMode) => {
        setMode(newMode);
        setForm({ name: '', email: '', password: '', otp: '', newPassword: '' }); // Clear form on mode switch
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={{textAlign:'center', marginBottom:30}}><HardDrive size={50} color="#3b82f6" /><h2>{mode.toUpperCase()}</h2></div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {mode === 'signup' && <div style={styles.inputGroup}><User size={18}/><input style={styles.inputNo} placeholder="Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required /></div>}
                    {(mode === 'login' || mode === 'signup' || mode === 'forgot' || mode === 'reset') && ( // Email always visible unless specifically in OTP-only step
                         <div style={styles.inputGroup}><Mail size={18}/><input style={styles.inputNo} type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required /></div>
                    )}
                    
                    {(mode === 'reset') && <input style={styles.inputFull} placeholder="6-Digit OTP" value={form.otp} onChange={e=>setForm({...form, otp: e.target.value})} required />}
                    
                    {(mode === 'login' || mode === 'signup' || mode === 'reset') && ( // Password fields
                        <div style={styles.inputGroup}>
                            <Lock size={18}/><input style={styles.inputNo} type={showPassword ? "text" : "password"} placeholder={mode === 'reset' ? "New Password" : "Password"} value={form.password} onChange={e=>setForm({...form, password: e.target.value})} required />
                            <div onClick={()=>setShowPassword(!showPassword)} style={{cursor:'pointer'}}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</div>
                        </div>
                    )}

                    <button style={styles.btn} type="submit">Continue</button>
                    
                    {mode === 'login' && <p onClick={() => switchTo('signup')} style={styles.toggle}>Don't have an account? Sign up</p>}
                    {mode === 'signup' && <p onClick={() => switchTo('login')} style={styles.toggle}>Already have an account? Login</p>}
                    {(mode === 'login' || mode === 'reset') && <p onClick={()=>switchTo('forgot')} style={{textAlign:'center', fontSize:12, cursor:'pointer'}}>Forgot Password?</p>}
                    {(mode === 'forgot') && <p onClick={()=>switchTo('login')} style={{textAlign:'center', fontSize:12, cursor:'pointer'}}>Back to Login</p>}
                    {(mode === 'reset') && <p onClick={()=>switchTo('forgot')} style={{textAlign:'center', fontSize:12, cursor:'pointer'}}>Resend OTP</p>}
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' },
    card: { background: '#fff', padding: 40, borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: 400 },
    inputGroup: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' },
    inputNo: { border: 'none', background: 'transparent', outline: 'none', width: '100%' },
    inputFull: { padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9', outline: 'none' },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 },
    toggle: { cursor: 'pointer', color: '#3b82f6', textAlign: 'center', fontSize: 14, marginTop:10 }
};

export default Auth;