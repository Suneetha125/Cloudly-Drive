import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [mode, setMode] = useState('login'); // login, signup, forgot, reset
    const [form, setForm] = useState({ email: '', password: '', otp: '', newPassword: '', name: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (mode === 'forgot') {
                await axios.post(`${API}/auth/forgot-password`, { email: form.email });
                alert("OTP Sent!"); setMode('reset');
            } else if (mode === 'reset') {
                await axios.post(`${API}/auth/reset-password`, { email: form.email, otp: form.otp, newPassword: form.password });
                alert("Password Reset Success!"); setMode('login');
            } else if (mode === 'signup') {
                await axios.post(`${API}/auth/register`, form);
                alert("Signup success!"); setMode('login');
            } else {
                const res = await axios.post(`${API}/auth/login`, form);
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) { alert(err.response?.data?.error || "Error"); }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 40, borderRadius: 20, width: 350, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <div style={{textAlign:'center', marginBottom:20}}><HardDrive size={50} color="#3b82f6" /><h2>{mode.toUpperCase()}</h2></div>
                {mode === 'signup' && <input placeholder="Name" style={s.inp} onChange={e=>setForm({...form, name:e.target.value})} required/>}
                {mode !== 'reset' && <input type="email" placeholder="Email" style={s.inp} onChange={e=>setForm({...form, email:e.target.value})} required/>}
                {mode === 'reset' && <input placeholder="6-Digit OTP" style={s.inp} onChange={e=>setForm({...form, otp:e.target.value})} required/>}
                {mode !== 'forgot' && <input type="password" placeholder={mode==='reset'?"New Password":"Password"} style={s.inp} onChange={e=>setForm({...form, password:e.target.value})} required/>}
                <button type="submit" style={s.btn}>Continue</button>
                <div style={{ textAlign: 'center', marginTop: 15 }}>
                    <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ cursor: 'pointer', color: '#3b82f6', fontSize: 14 }}>
                        {mode === 'login' ? "Need an account? Sign up" : "Back to Login"}
                    </p>
                    {mode === 'login' && <p onClick={() => setMode('forgot')} style={{ marginTop: 10, fontSize: 12, cursor: 'pointer', color: '#64748b' }}>Forgot Password?</p>}
                </div>
            </form>
        </div>
    );
};

const s = {
    inp: { width: '100%', padding: 12, marginBottom: 15, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' },
    btn: { width: '100%', padding: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }
};

export default Auth;