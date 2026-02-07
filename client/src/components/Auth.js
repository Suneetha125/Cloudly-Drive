import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API}/auth/${isLogin ? 'login' : 'register'}`, form);
            if (isLogin) {
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            } else {
                alert("Account created! Please login.");
                setIsLogin(true);
            }
        } catch (err) { alert(err.response?.data?.error || "Auth failed"); }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={{textAlign:'center', marginBottom:30}}>
                    <HardDrive size={50} color="#3b82f6" />
                    <h2 style={{marginTop:10}}>{isLogin ? 'Login to Cloudly' : 'Create Account'}</h2>
                </div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {!isLogin && <input style={styles.input} placeholder="Name" onChange={e=>setForm({...form, name: e.target.value})} required />}
                    <input style={styles.input} type="email" placeholder="Email" onChange={e=>setForm({...form, email: e.target.value})} required />
                    <input style={styles.input} type="password" placeholder="Password" onChange={e=>setForm({...form, password: e.target.value})} required />
                    <button style={styles.btn} type="submit">{isLogin ? 'Sign In' : 'Get Started'}</button>
                    <p onClick={() => setIsLogin(!isLogin)} style={{cursor:'pointer', color:'#3b82f6', textAlign:'center', fontSize:14}}>
                        {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
                    </p>
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' },
    card: { background: '#fff', padding: 40, borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: 400 },
    input: { padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9', outline: 'none' },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 }
};

export default Auth;