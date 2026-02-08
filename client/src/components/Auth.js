import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'verify'
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
            } else {
                const res = await axios.post(`${API}/auth/login`, form);
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) { 
            if (err.response?.status === 403) {
                alert("Email not verified. Sending you to verification screen.");
                setMode('verify');
            } else {
                alert(err.response?.data?.error || "Auth failed.");
            }
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={{textAlign:'center', marginBottom:30}}>
                    <HardDrive size={50} color="#3b82f6" />
                    <h2>{mode === 'login' ? 'Login' : mode === 'signup' ? 'Create Account' : 'Verify Email'}</h2>
                </div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {mode === 'signup' && <div style={styles.inputGroup}><User size={18}/><input style={styles.inputNo} placeholder="Name" onChange={e=>setForm({...form, name: e.target.value})} required /></div>}
                    
                    {mode !== 'verify' && <div style={styles.inputGroup}><Mail size={18}/><input style={styles.inputNo} type="email" placeholder="Email" onChange={e=>setForm({...form, email: e.target.value})} required /></div>}
                    
                    {mode === 'verify' && (
                        <>
                            <p style={{fontSize:12, color:'gray'}}>Enter code sent to {form.email}</p>
                            <input style={styles.input} placeholder="6-Digit OTP" onChange={e=>setForm({...form, otp: e.target.value})} required />
                        </>
                    )}
                    
                    {mode !== 'verify' && (
                        <div style={styles.inputGroup}>
                            <Lock size={18}/>
                            <input style={styles.inputNo} type={showPassword ? "text" : "password"} placeholder="Password" onChange={e=>setForm({...form, password: e.target.value})} required />
                            <div onClick={()=>setShowPassword(!showPassword)} style={{cursor:'pointer'}}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</div>
                        </div>
                    )}

                    <button style={styles.btn} type="submit">{mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Get Started' : 'Verify'}</button>
                    <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{cursor:'pointer', color:'#3b82f6', textAlign:'center', fontSize:14}}>{mode === 'login' ? "Need an account? Sign up" : "Already have an account? Login"}</p>
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
    input: { padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9', outline: 'none' },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 }
};

export default Auth;