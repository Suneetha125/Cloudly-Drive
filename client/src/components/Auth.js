import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User } from 'lucide-react';

// CHANGE THIS TO YOUR ACTUAL RENDER URL
const API = "https://cloudly-dj52.onrender.com/api"; 

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Force lowercase email to prevent login errors
            const submitData = { 
                ...form,
                email: form.email.toLowerCase().trim() 
            };
            
            const url = `${API}/auth/${isLogin ? 'login' : 'register'}`;
            const res = await axios.post(url, submitData);
            
            if (isLogin) {
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            } else {
                alert("Success! Now please login.");
                setIsLogin(true);
            }
        } catch (err) {
            // This shows the EXACT error from your backend status 400
            alert(err.response?.data?.error || "Connection Error");
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={{textAlign:'center', marginBottom:30}}>
                    <HardDrive size={50} color="#3b82f6" />
                    <h2 style={{marginTop:10, color: '#1e293b'}}>{isLogin ? 'Login to Cloudly' : 'Create Account'}</h2>
                </div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {!isLogin && (
                        <div style={styles.inputGroup}>
                            <User size={18} color="#94a3b8"/>
                            <input style={styles.input} placeholder="Full Name" onChange={e=>setForm({...form, name: e.target.value})} required />
                        </div>
                    )}
                    <div style={styles.inputGroup}>
                        <Mail size={18} color="#94a3b8"/>
                        <input style={styles.input} type="email" placeholder="Email Address" onChange={e=>setForm({...form, email: e.target.value})} required />
                    </div>
                    <div style={styles.inputGroup}>
                        <Lock size={18} color="#94a3b8"/>
                        <input style={styles.input} type="password" placeholder="Password" onChange={e=>setForm({...form, password: e.target.value})} required />
                    </div>
                    <button style={styles.btn} type="submit">{isLogin ? 'Sign In' : 'Get Started'}</button>
                    <p onClick={() => setIsLogin(!isLogin)} style={styles.toggleText}>
                        {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
                    </p>
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
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
    toggleText: { cursor: 'pointer', color: '#3b82f6', textAlign: 'center', fontSize: 14, fontWeight: '500', marginTop: 10 }
};

export default Auth;