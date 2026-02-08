import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot', 'verify', 'reset'
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', otp: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (mode === 'signup') {
                await axios.post(`${API}/auth/register`, form);
                alert("OTP Sent to your email!");
                setMode('verify');
            } else if (mode === 'verify') {
                await axios.post(`${API}/auth/verify`, { email: form.email, otp: form.otp });
                alert("Verified! Please Login.");
                setMode('login');
            } else if (mode === 'forgot') {
                await axios.post(`${API}/auth/forgot-password`, { email: form.email });
                alert("Reset code sent to email!");
                setMode('reset');
            } else if (mode === 'reset') {
                await axios.post(`${API}/auth/reset-password`, { email: form.email, otp: form.otp, newPassword: form.password });
                alert("Password updated! Please login.");
                setMode('login');
            } else {
                const res = await axios.post(`${API}/auth/login`, form);
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) { alert(err.response?.data?.error || "Error"); }
    };

    const theme = { accent: '#3b82f6', text: '#1e293b', sub: '#64748b', bg: '#f8fafc' };

    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: theme.bg, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ background: '#fff', padding: 40, borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: 400 }}>
                <div style={{textAlign:'center', marginBottom:30}}>
                    <HardDrive size={50} color={theme.accent} />
                    <h2 style={{marginTop:10, color: theme.text}}>
                        {mode === 'login' ? 'Login to Cloudly' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Recover' : 'Verify'}
                    </h2>
                </div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {mode === 'signup' && <div style={styles.inputGroup}><User size={18} color={theme.sub}/><input style={styles.input} placeholder="Full Name" onChange={e=>setForm({...form, name: e.target.value})} required /></div>}
                    
                    {(mode !== 'verify' && mode !== 'reset') && <div style={styles.inputGroup}><Mail size={18} color={theme.sub}/><input style={styles.input} type="email" placeholder="Email Address" onChange={e=>setForm({...form, email: e.target.value})} required /></div>}
                    
                    {(mode === 'verify' || mode === 'reset') && <input style={styles.inputFull} placeholder="6-Digit OTP" onChange={e=>setForm({...form, otp: e.target.value})} required />}
                    
                    {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
                        <div style={styles.inputGroup}>
                            <Lock size={18} color={theme.sub}/>
                            <input style={styles.input} type={showPassword ? "text" : "password"} placeholder={mode === 'reset' ? "New Password" : "Password"} onChange={e=>setForm({...form, password: e.target.value})} required />
                            <div onClick={()=>setShowPassword(!showPassword)} style={{cursor:'pointer'}}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</div>
                        </div>
                    )}

                    <button style={styles.btn} type="submit">
                        {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Get Started' : 'Continue'}
                    </button>

                    {mode === 'login' && <p onClick={() => setMode('forgot')} style={{textAlign:'right', fontSize:12, color:theme.sub, cursor:'pointer', marginTop:-5}}>Forgot Password?</p>}

                    <p onClick={() => {setMode(mode === 'login' ? 'signup' : 'login'); setShowPassword(false)}} style={{cursor:'pointer', color:theme.accent, textAlign:'center', fontSize:14, fontWeight:'500'}}>
                        {mode === 'login' ? "Need an account? Sign up" : "Already have an account? Login"}
                    </p>
                </form>
            </div>
        </div>
    );
};

const styles = {
    inputGroup: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' },
    input: { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 15 },
    inputFull: { padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9', outline: 'none', fontSize: 15 },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16, marginTop: 10 }
};

export default Auth;