// import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { 
//   FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
//   MoreVertical, Share2, Shield, LayoutGrid, Eye, Star, Users, Move, Clock, Fingerprint
// } from 'lucide-react';

// // const API = "http://127.0.0.1:5000/api";
// const API = "https://cloudly-dj52.onrender.com/api";
// const CHUNK_SIZE = 5 * 1024 * 1024;

// const Drive = () => {
//     const [filesList, setFilesList] = useState([]);
//     const [foldersList, setFoldersList] = useState([]);
//     const [allFolders, setAllFolders] = useState([]); 
//     const [currentFolder, setCurrentFolder] = useState(null);
//     const [path, setPath] = useState([]); 
//     const [searchQuery, setSearchQuery] = useState("");
//     const [activeTab, setActiveTab] = useState('files');
//     const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
//     const [storage, setStorage] = useState({ used: 0, limit: 1 });
//     const [activeMenu, setActiveMenu] = useState(null);
//     const [progress, setProgress] = useState(0);
//     const [previewFile, setPreviewFile] = useState(null);
//     const [shareModal, setShareModal] = useState(null);
//     const [moveModal, setMoveModal] = useState(null); 
//     const [vaultModal, setVaultModal] = useState(false);
//     const [vaultPIN, setVaultPIN] = useState(""); 
//     const [isVaultSetup, setIsVaultSetup] = useState(false);

//     const navigate = useNavigate();
//     const token = localStorage.getItem("token");
//     const userName = localStorage.getItem("userName") || "User";

//     const getAuth = useCallback(() => ({ 
//         headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } 
//     }), []);

//     const fetchData = useCallback(async () => {
//         if (!token) return navigate('/');
//         try {
//             const fId = currentFolder ? currentFolder._id : "null";
//             const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}`, getAuth());
//             setFilesList(res.data.files || []); setFoldersList(res.data.folders || []);
//             const sRes = await axios.get(`${API}/drive/storage`, getAuth());
//             setStorage(sRes.data);
//         } catch (e) { if(e.response?.status === 401) navigate('/'); }
//     }, [currentFolder, activeTab, navigate, token, getAuth]);

//     useEffect(() => { fetchData(); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }, [fetchData, isDark]);

//     useEffect(() => {
//         const handleEsc = (e) => { if (e.key === 'Escape') { setActiveMenu(null); setVaultModal(false); setMoveModal(null); setShareModal(null); setPreviewFile(null); } };
//         window.addEventListener('keydown', handleEsc);
//         return () => window.removeEventListener('keydown', handleEsc);
//     }, []);

//     const handleBreadcrumb = (idx) => {
//         if (idx === -1) { setPath([]); setCurrentFolder(null); }
//         else { const n = path.slice(0, idx + 1); setPath(n); setCurrentFolder(n[n.length-1]); }
//     };

//     const handleOpenFolder = (f) => {
//         if (!path.find(p => p._id === f._id)) { setPath([...path, f]); setCurrentFolder(f); }
//     };

//     const runAction = async (method, url, data = {}) => {
//         try {
//             if (method === 'delete') await axios.delete(`${API}/drive/${url}`, getAuth());
//             else await axios[method](`${API}/drive/${url}`, data, getAuth());
//             setActiveMenu(null); fetchData();
//         } catch (err) { alert("Action failed."); }
//     };

//     const handleUpload = async (e) => {
//         const files = Array.from(e.target.files);
//         for (let file of files) {
//             const init = await axios.post(`${API}/upload/initialize`, {}, getAuth());
//             const chunks = Math.ceil(file.size / CHUNK_SIZE);
//             for (let i = 0; i < chunks; i++) {
//                 const fd = new FormData();
//                 fd.append('chunk', file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
//                 fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
//                 await axios.post(`${API}/upload/chunk`, fd, getAuth());
//                 setProgress(Math.round(((i+1)/chunks)*100));
//             }
//             await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id, isVault: activeTab === 'vault' }, getAuth());
//         }
//         setProgress(0); fetchData();
//     };

//     const handleRegisterFingerprint = async () => {
//         try {
//             const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
//             const options = { 
//                 publicKey: { 
//                     challenge, 
//                     rp: { name: "Cloudly Drive" }, 
//                     user: { id: Uint8Array.from(userName, c => c.charCodeAt(0)), name: userName, displayName: userName }, 
//                     // ADDED REQUIRED ALGORITHMS FOR EDGE/CHROME:
//                     pubKeyCredParams: [
//                         { alg: -7, type: "public-key" },  // ES256
//                         { alg: -257, type: "public-key" } // RS256
//                     ], 
//                     authenticatorSelection: { authenticatorAttachment: "platform" }, 
//                     timeout: 60000 
//                 } 
//             };
//             const cred = await navigator.credentials.create(options);
//             const credentialId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
//             await axios.post(`${API}/vault/register-biometric`, { credentialId }, getAuth());
//             alert("Fingerprint Registered!");
//         } catch (err) { alert("Registration failed. Your device hardware might be locked."); }
//     };

//     const handleFingerprintReset = async () => {
//         try {
//             const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
//             const assertion = await navigator.credentials.get({ publicKey: { challenge, timeout: 60000, userVerification: "required" } });
//             const credentialId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
//             const newPin = prompt("Biometric Verified! Enter new 4-digit PIN:");
//             if (newPin?.length === 4) { await axios.post(`${API}/vault/reset-with-biometric`, { credentialId, newPin }, getAuth()); alert("Reset Success!"); setVaultModal(false); }
//         } catch (e) { alert("Verification failed."); }
//     };
//    const handleShareSubmit = async () => {
//         const email = document.getElementById('sEmail').value;
//         const hours = document.getElementById('sHours').value;
//         if(!email.includes("@")) return alert("Enter valid email");

//         try {
//             // Explicitly calling the path to avoid runAction dynamic errors
//             await axios.post(`${API}/drive/share`, { fileId: shareModal._id, email, hours }, getAuth());
//             alert("File Shared Successfully!");
//             setShareModal(null);
//             fetchData();
//         } catch (err) {
//             alert(err.response?.data?.error || "User not found.");
//         }
//     };
//     const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#fff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0' };

//     const filteredFolders = foldersList.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
//     const filteredFiles = filesList.filter(f => f.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

//     return (
//         <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex', fontFamily: 'Inter, sans-serif' }} onClick={() => setActiveMenu(null)}>
            
//             <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: 25, display: 'flex', flexDirection: 'column', gap: 10, background: theme.card }}>
//                 <h2 style={{color: '#3b82f6', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
//                     Cloudly 
//                     {isDark ? <Sun onClick={()=>setIsDark(false)} cursor="pointer" size={20}/> : <Moon onClick={()=>setIsDark(true)} cursor="pointer" size={20}/>}
//                 </h2>
//                 <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('files'); handleBreadcrumb(-1);}}><LayoutGrid size={20}/> My Drive</div>
//                 <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('starred'); handleBreadcrumb(-1);}}><Star size={20}/> Starred</div>
//                 <div style={activeTab==='shared'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('shared'); handleBreadcrumb(-1);}}><Users size={20}/> Shared</div>
//                 <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={async (e)=>{ e.stopPropagation(); const res = await axios.get(`${API}/vault/status`, getAuth()); setIsVaultSetup(!res.data.hasPIN); setVaultModal(true); }}><Shield size={20} color="red"/> Vault</div>
                
//                 <div style={{ marginTop: 'auto', padding: 15, background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 12 }}>
//                     <p style={{fontSize: 11, fontWeight:'bold'}}>Storage: {(storage.used/1024/1024).toFixed(1)}MB / 50GB</p>
//                     <div style={styles.progBg}><div style={{...styles.progFill, width: `${(storage.used/storage.limit)*100}%`}}></div></div>
//                 </div>
//             </aside>

//             <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
//                 <header style={{ height: 70, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
//                     <div style={{...styles.search, background: theme.card, border: `1px solid ${theme.border}`}}>
//                         <Search size={18}/><input placeholder="Search files..." style={{color: theme.text, background:'none', border:'none', outline:'none', marginLeft:10, width:'100%'}} value={searchQuery || ""} onChange={(e) => setSearchQuery(e.target.value)}/>
//                     </div>
//                     <div style={{display:'flex', gap:20, alignItems:'center'}}><b style={{fontSize:14}}>{userName}</b><button onClick={()=>{localStorage.clear(); navigate('/')}} style={styles.logout}><LogOut size={18}/></button></div>
//                 </header>

//                 <div style={{ padding: 40 }}>
//                     <div style={styles.toolbar}>
//                         <div style={styles.breadcrumb}><span onClick={()=>handleBreadcrumb(-1)} style={{fontWeight:'bold', color: '#3b82f6', cursor:'pointer'}}>Root</span>{path.map((p, i) => <span key={p._id} onClick={()=>handleBreadcrumb(i)} style={{display:'flex', alignItems:'center', cursor:'pointer'}}><ChevronRight size={16}/> {p.name}</span>)}</div>
//                         <div style={{display:'flex', gap:10}}>{progress > 0 && <span style={{alignSelf:'center', fontWeight:'bold', fontSize:12}}>{progress}%</span>}<label style={styles.btnBlue}><Upload size={18}/> Upload <input type="file" hidden multiple onChange={handleUpload}/></label>
//                         <button style={{...styles.btnWhite, color:theme.text, borderColor:theme.border}} onClick={()=>{const n=prompt("Name:"); n && runAction('post', 'folder', {name:n, parentFolder:currentFolder?._id, isVault:activeTab==='vault'})}}><FolderPlus size={18}/></button></div>
//                     </div>

//                     <div style={styles.grid}>
//                         {filteredFolders.map(f => (
//                             <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}} onDoubleClick={()=>handleOpenFolder(f)}>
//                                 <Folder size={48} color="#fbbf24" fill="#fbbf24"/><p style={{marginTop:15, fontWeight:'500'}}>{f.name}</p>
//                                 <Star size={16} onClick={(e)=>{e.stopPropagation(); runAction('patch', `star/folder/${f._id}`)}} style={{position:'absolute', top:15, left:15, cursor:'pointer'}} fill={f.isStarred ? '#fbbf24' : 'none'} color={f.isStarred ? '#fbbf24' : '#94a3b8'}/>
//                                 <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
//                                 {activeMenu === f._id && <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}><div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/drive/all-folders`, getAuth()).then(res=>{setAllFolders(res.data); setMoveModal({id: f._id, type:'folder'})})}}><Move size={14}/> Move To</div><div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); runAction('delete', `delete/folder/${f._id}`)}}><Trash2 size={14}/> Delete</div></div>}
//                             </div>
//                         ))}
//                         {filteredFiles.map(f => (
//                             <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}}>
//                                 <FileText size={48} color="#3b82f6"/><p style={{marginTop:15, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.fileName}</p>
//                                 <Star size={16} onClick={(e)=>{e.stopPropagation(); runAction('patch', `star/file/${f._id}`)}} style={{position:'absolute', top:15, left:15, cursor:'pointer'}} fill={f.isStarred ? '#3b82f6' : 'none'} color={f.isStarred ? '#3b82f6' : '#94a3b8'}/>
//                                 <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
//                                 {activeMenu === f._id && <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}><div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/drive/preview/${f._id}`, getAuth()).then(res=>setPreviewFile(res.data.url))}}><Eye size={14}/> Preview</div><div onClick={(e)=>{e.stopPropagation(); setShareModal(f)}}><Share2 size={14}/> Share</div><div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/drive/all-folders`, getAuth()).then(res=>{setAllFolders(res.data); setMoveModal({id: f._id, type:'file'})})}}><Move size={14}/> Move To</div><div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); runAction('delete', `delete/file/${f._id}`)}}><Trash2 size={14}/> Delete</div></div>}
//                             </div>
//                         ))}
//                         {filteredFolders.length === 0 && filteredFiles.length === 0 && searchQuery && <div style={{gridColumn:'1/-1', textAlign:'center', padding:50}}><Search size={40} style={{opacity:0.2}}/><p>No files or folders found matching "{searchQuery}"</p></div>}
//                     </div>
//                 </div>
//             </main>

//             {moveModal && <div style={styles.overlay} onClick={()=>setMoveModal(null)}><div style={{...styles.modalSmall, background: theme.card, width: 400}} onClick={e=>e.stopPropagation()}><h3>Move Item to...</h3><div style={styles.moveList}><div style={{...styles.moveItem, color:'#3b82f6'}} onClick={()=>runAction('patch', 'move', {itemId:moveModal.id, type:moveModal.type, targetId:'root'})}><LayoutGrid size={16}/> My Drive (Root)</div><div style={{...styles.moveItem, color:'#ef4444'}} onClick={()=>runAction('patch', 'move', {itemId:moveModal.id, type:moveModal.type, targetId:'vault_root'})}><Shield size={16}/> Private Vault (Root)</div><div style={{borderBottom:'1px solid #eee', margin:'10px 0'}}></div>{allFolders.filter(f=>f._id!==moveModal.id).map(f=>(<div key={f._id} style={styles.moveItem} onClick={()=>runAction('patch', 'move', {itemId:moveModal.id, type:moveModal.type, targetId:f._id})}><Folder size={14} color={f.isVault?"#ef4444":"#fbbf24"}/> {f.name} {f.isVault?'(Vault)':''}</div>))}</div><button onClick={()=>setMoveModal(null)} style={{...styles.btnWhite, marginTop:20, width:'100%', color:theme.text}}>Cancel</button></div></div>}
//            {shareModal && (
//         <div style={styles.overlay} onClick={()=>setShareModal(null)}>
//             <div style={{...styles.modalSmall, background: theme.card}} onClick={e=>e.stopPropagation()}>
//                 <h3>Share "{shareModal.fileName}"</h3>
//                 <input id="sEmail" type="email" placeholder="Registered Email" style={styles.inp} />
//                 <select id="sHours" style={{...styles.inp, marginTop:10}}>
//                     <option value="">Lifetime Access</option>
//                     <option value="1">1 Hour</option>
//                     <option value="24">1 Day</option>
//                 </select>
//                 <button onClick={handleShareSubmit} style={styles.btnBlue}>Grant Access</button>
//             </div>
//         </div>
//     )}
//             {vaultModal && <div style={styles.overlay} onClick={()=>setVaultModal(false)}><div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}><Shield size={40} color="red" style={{marginBottom:15}}/><h3>{isVaultSetup ? "Set Secret PIN" : "Unlock Vault"}</h3><input type="password" style={{...styles.pinInp, color: theme.text}} value={vaultPIN || ""} maxLength={4} onChange={e=>setVaultPIN(e.target.value)} autoFocus/><button onClick={async ()=>{ try { await axios.post(`${API}/vault/unlock`, {pin: vaultPIN}, getAuth()); setVaultModal(false); setActiveTab('vault'); } catch(e) { alert("Wrong PIN"); } }} style={styles.btnBlue}>{isVaultSetup ? "Setup" : "Unlock"}</button><div style={{marginTop:20, paddingTop:15, borderTop:'1px solid #ddd'}}>{!isVaultSetup && <p onClick={handleFingerprintReset} style={{fontSize:12, color:'#3b82f6', cursor:'pointer', marginBottom:10}}>Forgot PIN? Use Fingerprint</p>}<button onClick={handleRegisterFingerprint} style={styles.btnBiometric}><Fingerprint size={14} style={{marginRight:8}}/> Register Fingerprint</button></div></div></div>}
//             {previewFile && <div style={styles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'80%', height:'80%', borderRadius:15, overflow:'hidden'}} onClick={e=>e.stopPropagation()}><embed src={previewFile} width="100%" height="100%"/></div></div>}
//         </div>
//     );
// };

// const styles = {
//     nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: '#64748b', fontSize: '14px', fontWeight: '500' },
//     navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background:'#3b82f6', color:'#fff', fontWeight:'bold', fontSize: '14px' },
//     btnBlue: { background:'#3b82f6', color:'#fff', padding:'10px 20px', borderRadius:8, cursor:'pointer', border:'none', fontWeight:'bold', display:'flex', gap:8, alignItems:'center' },
//     btnWhite: { border:'1px solid', padding:10, borderRadius:8, cursor:'pointer', background:'transparent' },
//     grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25 },
//     card: { padding:25, borderRadius:15, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
//     dots: { position:'absolute', top:15, right:15, cursor:'pointer' },
//     drop: { position:'absolute', top:40, right:15, padding:12, borderRadius:8, width:140, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, display:'flex', flexDirection:'column', gap:10, textAlign:'left' },
//     breadcrumb: { display:'flex', gap:8, color:'#94a3b8', cursor:'pointer', fontSize:'14px' },
//     toolbar: { display:'flex', justifyContent:'space-between', marginBottom:30, alignItems:'center' },
//     overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
//     modalSmall: { padding:30, borderRadius:15, width:320, textAlign:'center' },
//     pinInp: { width:'100%', padding:10, fontSize:22, textAlign:'center', letterSpacing:10, marginBottom:15, borderRadius:8, border:'1px solid #ddd', background:'none' },
//     moveItem: { padding:12, borderBottom:'1px solid #eee', cursor:'pointer', textAlign:'left', display:'flex', gap:10, fontSize:14 },
//     logout: { background:'none', border:'none', color:'red', cursor:'pointer', display:'flex', gap:5, fontWeight:'bold' },
//     search: { padding:'8px 15px', borderRadius:8, display:'flex', alignItems:'center', width:400 },
//     progBg: { height: 6, background: '#eee', borderRadius: 10, marginTop: 10 },
//     progFill: { height: '100%', background: '#3b82f6', borderRadius: 10 },
//     inp: { width:'100%', padding:10, borderRadius:8, border:'1px solid #ddd', background:'transparent' },
//     moveList: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5 },
//     btnBiometric: { background:'none', border:'1px solid #ddd', color:'inherit', padding:'8px 15px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', fontSize:12 }
// };

// export default Drive;
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const CHUNK_SIZE = 5 * 1024 * 1024;

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [activeTab, setActiveTab] = useState('files');
    const [path, setPath] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [moveModal, setMoveModal] = useState(null);
    const [vaultModal, setVaultModal] = useState(false);
    const [storage, setStorage] = useState({ used: 0, limit: 1 });

    const navigate = useNavigate();
    const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);
    const userName = localStorage.getItem("userName") || "User";

    const fetchData = useCallback(async () => {
        try {
            const fId = currentFolder ? currentFolder._id : "null";
            const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}`, authConfig());
            setFilesList(res.data.files); setFoldersList(res.data.folders);
            const sRes = await axios.get(`${API}/drive/storage`, authConfig());
            setStorage(sRes.data);
        } catch (err) { navigate('/'); }
    }, [currentFolder, activeTab, authConfig, navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (let file of files) {
            const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
            const chunks = Math.ceil(file.size / CHUNK_SIZE);
            const promises = [];
            for (let i = 0; i < chunks; i++) {
                const fd = new FormData();
                fd.append('chunk', file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
                fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
                promises.push(axios.post(`${API}/upload/chunk`, fd, authConfig()));
            }
            await Promise.all(promises);
            await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id, isVault: activeTab === 'vault' }, authConfig());
        }
        fetchData();
    };

    const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#ffffff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex', fontFamily: 'Inter, sans-serif' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
            {/* Sidebar */}
            <aside style={{ width: '280px', borderRight: `1px solid ${theme.border}`, padding: '30px 15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <h1 style={{fontSize:20, fontWeight:'bold', padding:'0 15px', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab === 'files' ? styles.navActive : styles.navItem} onClick={() => setActiveTab('files')}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab === 'shared' ? styles.navActive : styles.navItem} onClick={() => setActiveTab('shared')}><Users size={20}/> Shared</div>
                <div style={activeTab === 'starred' ? styles.navActive : styles.navItem} onClick={() => setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={activeTab === 'trash' ? styles.navActive : styles.navItem} onClick={() => setActiveTab('trash')}><Trash2 size={20}/> Trash</div>
                <div style={activeTab === 'vault' ? styles.navActive : styles.navItem} onClick={() => setVaultModal(true)}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={styles.storageBox}>
                    <p>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / 100GB</p>
                    <div style={styles.bar}><div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div></div>
                </div>
            </aside>

            {/* Main */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: '80px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={styles.searchBar}><Search size={18} color="#94a3b8"/><input placeholder="Search files..." style={{border:'none', background:'transparent', marginLeft:15, width:'100%', outline:'none', color:theme.text}} /></div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', position:'relative' }}>
                        <div style={styles.userCircle} onClick={(e)=>{e.stopPropagation(); setProfileOpen(!profileOpen)}}>{userName[0]}</div>
                        {profileOpen && (
                            <div style={{...styles.profileDrop, backgroundColor:theme.card, border:`1px solid ${theme.border}`}}>
                                <p style={{fontWeight:'bold'}}>Hi, {userName}!</p>
                                <button onClick={()=>{localStorage.clear(); navigate('/')}} style={styles.logoutBtn}><LogOut size={16}/> Sign out</button>
                            </div>
                        )}
                    </div>
                </header>

                <div style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
                    <div style={styles.breadcrumb}>
                        <span onClick={() => {setCurrentFolder(null); setPath([])}} style={{cursor:'pointer'}}>My Drive</span>
                        {path.map((p, i) => <span key={p._id} onClick={() => {const n=path.slice(0,i+1); setPath(n); setCurrentFolder(p);}} style={{cursor:'pointer'}}> <ChevronRight size={16} style={{display:'inline'}}/> {p.name}</span>)}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            <label style={styles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                            <button style={styles.btnWhite} onClick={() => {const n=prompt("Name:"); n && axios.post(`${API}/folders`,{name:n, parentFolder:currentFolder?._id, isVault: activeTab==='vault'}, authConfig()).then(fetchData)}}><FolderPlus size={18}/></button>
                        </div>
                    </div>

                    <div style={styles.grid}>
                        {foldersList.map(f => (
                            <div key={`folder-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}} onDoubleClick={() => {setPath([...path, f]); setCurrentFolder(f)}}>
                                <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                                <p style={{marginTop:15, fontWeight:'600'}}>{f.name}</p>
                                <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                                {activeMenu === f._id && (
                                    <div style={{...styles.drop, backgroundColor: theme.card, border:`1px solid ${theme.border}`}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.patch(`${API}/drive/star/folder/${f._id}`,{},authConfig()).then(fetchData)}}><Star size={14}/> Star</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/folders/${f._id}`,authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filesList.map(f => (
                            <div key={`file-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}}>
                                <FileText size={48} color={theme.accent}/>
                                <p style={{marginTop:15, fontWeight:'500', fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.fileName}</p>
                                <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                                {activeMenu === f._id && (
                                    <div style={{...styles.drop, backgroundColor: theme.card, border:`1px solid ${theme.border}`}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/files/preview/${f._id}`, authConfig()).then(res => setPreviewFile({...f, url: res.data.url}))}}><Eye size={14}/> Open</div>
                                        <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Target Folder ID (or 'root'):"); axios.patch(`${API}/files/move`, {fileId:f._id, targetId:tid}, authConfig()).then(fetchData)}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/files/${f._id}`,authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* VAULT MODAL */}
            {vaultModal && (
                <div style={styles.overlay} onClick={()=>setVaultModal(false)}>
                    <div style={{...styles.modalSmall, backgroundColor: theme.card}} onClick={e=>e.stopPropagation()}>
                        <Shield size={48} color="#ef4444" style={{margin:'0 auto 20px', display:'block'}}/>
                        <h3>Unlock Vault</h3>
                        <input type="password" maxLength={4} style={styles.pinInput} placeholder="****" id="vpin"/>
                        <button onClick={()=>{const p=document.getElementById('vpin').value; axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()).then(()=> {setActiveTab('vault'); setVaultModal(false);})}} style={styles.btnBluePro}>Unlock</button>
                        <button onClick={()=>{alert("Simulating Biometrics..."); setTimeout(()=>{setActiveTab('vault'); setVaultModal(false);}, 1000)}} style={{...styles.btnWhitePro, marginTop:10, width:'100%'}}><Fingerprint size={20}/> Use Fingerprint</button>
                    </div>
                </div>
            )}

            {previewFile && (
                <div style={styles.overlay} onClick={()=>setPreviewFile(null)}>
                    <div style={{...styles.modal, backgroundColor: theme.card}} onClick={e=>e.stopPropagation()}>
                        <header style={{padding:20, display:'flex', justifyContent:'space-between', borderBottom:`1px solid ${theme.border}`}}>
                            <b>{previewFile.fileName}</b><X onClick={()=>setPreviewFile(null)} cursor="pointer"/>
                        </header>
                        <embed src={previewFile.url} width="100%" height="100%"/>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    navItem: { display:'flex', gap:15, padding:'12px 20px', borderRadius:'25px', cursor:'pointer', color:'#5f6368', fontWeight:'500' },
    navActive: { display:'flex', gap:15, padding:'12px 20px', borderRadius:'25px', cursor:'pointer', background:'#e8f0fe', color:'#1967d2', fontWeight:'600' },
    userCircle: { width:32, height:32, borderRadius:'50%', background:'#3b82f6', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', cursor:'pointer' },
    btnBlue: { background:'#1a73e8', color:'#fff', padding:'12px 24px', borderRadius:'24px', cursor:'pointer', display:'flex', gap:10, fontWeight:'500' },
    btnBluePro: { background:'#1a73e8', color:'#fff', border:'none', width:'100%', padding:12, borderRadius:8, cursor:'pointer', fontWeight:'bold' },
    btnWhitePro: { background:'transparent', border:'1px solid #dadce0', padding:10, borderRadius:8, cursor:'pointer' },
    btnWhite: { background:'transparent', border:'1px solid #dadce0', padding:10, borderRadius:'50%', cursor:'pointer' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:25 },
    card: { padding:'30px 20px', borderRadius:'16px', border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:15, right:15, color:'#5f6368', cursor:'pointer' },
    drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 6px rgba(0,0,0,0.1)', zIndex:100, padding:10, width:150, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left', border:'1px solid #eee' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
    modal: { width:'80%', height:'80%', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' },
    modalSmall: { width:350, padding:30, borderRadius:20 },
    profileDrop: { position:'absolute', top:45, right:0, width:200, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:20 },
    logoutBtn: { background:'none', border:'1px solid #dadce0', padding:'10px 20px', borderRadius:10, cursor:'pointer', width:'100%', marginTop:15 },
    storageBox: { marginTop: 'auto', padding: '20px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', color: '#000' },
    bar: { height:6, background:'#eee', borderRadius:10, marginTop:10, overflow:'hidden' },
    pinInput: { width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:15, textAlign:'center', fontSize:24, letterSpacing:10 },
    searchBar: { background: '#fff', width: '500px', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0' },
    breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18, marginBottom:30 }
};

export default Drive;