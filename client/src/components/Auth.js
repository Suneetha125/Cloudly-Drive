// import React, { useState } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { HardDrive } from 'lucide-react';

// const API = "https://cloudly-dj52.onrender.com/api";

// const Auth = () => {
//     const [mode, setMode] = useState('login'); // login, signup, forgot, reset
//     const [form, setForm] = useState({ email: '', password: '', otp: '', newPassword: '', name: '' });
//     const navigate = useNavigate();

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         try {
//             if (mode === 'forgot') {
//                 await axios.post(`${API}/auth/forgot-password`, { email: form.email });
//                 alert("OTP Sent!"); setMode('reset');
//             } else if (mode === 'reset') {
//                 await axios.post(`${API}/auth/reset-password`, { email: form.email, otp: form.otp, newPassword: form.password });
//                 alert("Password Reset Success!"); setMode('login');
//             } else if (mode === 'signup') {
//                 await axios.post(`${API}/auth/register`, form);
//                 alert("Signup success!"); setMode('login');
//             } else {
//                 const res = await axios.post(`${API}/auth/login`, form);
//                 localStorage.setItem("token", res.data.token);
//                 localStorage.setItem("userName", res.data.userName);
//                 navigate("/drive");
//             }
//         } catch (err) { alert(err.response?.data?.error || "Error"); }
//     };

//     return (
//         <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
//             <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 40, borderRadius: 20, width: 350, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
//                 <div style={{textAlign:'center', marginBottom:20}}><HardDrive size={50} color="#3b82f6" /><h2>{mode.toUpperCase()}</h2></div>
//                 {mode === 'signup' && <input placeholder="Name" style={s.inp} onChange={e=>setForm({...form, name:e.target.value})} required/>}
//                 {mode !== 'reset' && <input type="email" placeholder="Email" style={s.inp} onChange={e=>setForm({...form, email:e.target.value})} required/>}
//                 {mode === 'reset' && <input placeholder="6-Digit OTP" style={s.inp} onChange={e=>setForm({...form, otp:e.target.value})} required/>}
//                 {mode !== 'forgot' && <input type="password" placeholder={mode==='reset'?"New Password":"Password"} style={s.inp} onChange={e=>setForm({...form, password:e.target.value})} required/>}
//                 <button type="submit" style={s.btn}>Continue</button>
//                 <div style={{ textAlign: 'center', marginTop: 15 }}>
//                     <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ cursor: 'pointer', color: '#3b82f6', fontSize: 14 }}>
//                         {mode === 'login' ? "Need an account? Sign up" : "Back to Login"}
//                     </p>
//                     {mode === 'login' && <p onClick={() => setMode('forgot')} style={{ marginTop: 10, fontSize: 12, cursor: 'pointer', color: '#64748b' }}>Forgot Password?</p>}
//                 </div>
//             </form>
//         </div>
//     );
// };

// const s = {
//     inp: { width: '100%', padding: 12, marginBottom: 15, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' },
//     btn: { width: '100%', padding: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }
// };

// export default Auth;
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Auth = () => {
    const [mode, setMode] = useState('login'); 
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (mode === 'signup') {
                await axios.post(`${API}/auth/register`, form);
                alert("Account created! Please Login.");
                setMode('login');
            } else {
                const res = await axios.post(`${API}/auth/login`, form);
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userName", res.data.userName);
                navigate("/drive");
            }
        } catch (err) { alert(err.response?.data?.error || "Invalid Credentials"); }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
            <div style={{ background: '#fff', padding: 40, borderRadius: 24, boxShadow: '0 20px 25px rgba(0,0,0,0.1)', width: 380 }}>
                <div style={{textAlign:'center', marginBottom:30}}><HardDrive size={50} color="#3b82f6" /><h2>{mode.toUpperCase()}</h2></div>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:15}}>
                    {mode === 'signup' && <div style={s.group}><User size={18}/><input style={s.inp} placeholder="Name" onChange={e=>setForm({...form, name: e.target.value})} required /></div>}
                    <div style={s.group}><Mail size={18}/><input style={s.inp} type="email" placeholder="Email" onChange={e=>setForm({...form, email: e.target.value})} required /></div>
                    <div style={s.group}>
                        <Lock size={18}/><input style={s.inp} type={showPassword ? "text" : "password"} placeholder="Password" onChange={e=>setForm({...form, password: e.target.value})} required />
                        <div onClick={()=>setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</div>
                    </div>
                    <button style={s.btn} type="submit">Continue</button>
                    <p onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={s.toggle}>{mode === 'login' ? "Need an account? Sign up" : "Back to Login"}</p>
                </form>
            </div>
        </div>
    );
};

const s = {
    group: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' },
    inp: { border: 'none', background: 'transparent', outline: 'none', width: '100%' },
    btn: { padding: 14, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' },
    toggle: { cursor: 'pointer', color: '#3b82f6', textAlign: 'center', fontSize: 14 }
};

export default Auth;