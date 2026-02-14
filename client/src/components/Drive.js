// // 
// import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { 
//   FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, ChevronRight, Sun, Moon, 
//   MoreVertical, Share2, Users, Star, Shield, LayoutGrid, Eye, Move, UserX, Fingerprint
// } from 'lucide-react';

// const API = "https://cloudly-dj52.onrender.com/api"; 
// const CHUNK_SIZE = 5 * 1024 * 1024;

// const Drive = () => {
//     const [filesList, setFilesList] = useState([]);
//     const [foldersList, setFoldersList] = useState([]);
//     const [currentFolder, setCurrentFolder] = useState(null);
//     const [path, setPath] = useState([]);
//     const [activeTab, setActiveTab] = useState('files');
//     const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
//     const [storage, setStorage] = useState({ used: 0, limit: 1 });
//     const [uploadProgress, setUploadProgress] = useState({});
//     const [activeMenu, setActiveMenu] = useState(null);
//     const [shareModal, setShareModal] = useState(null);
//     const [vaultModal, setVaultModal] = useState({ open: false, step: 'unlock' });
//     const [previewFile, setPreviewFile] = useState(null);
//     const [profileOpen, setProfileOpen] = useState(false);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

//     const navigate = useNavigate();
//     const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);
//     const userName = localStorage.getItem("userName") || "User";

//     useEffect(() => {
//         document.documentElement.classList.toggle('dark', isDark);
//         localStorage.setItem('theme', isDark ? 'dark' : 'light');
//     }, [isDark]);

//     const fetchData = useCallback(async () => {
//         try {
//             const fId = currentFolder ? currentFolder._id : "null";
//             const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}&vaultUnlocked=${isVaultUnlocked}&search=${searchTerm}`, authConfig());
//             setFilesList(res.data.files || []); setFoldersList(res.data.folders || []);
//             const sRes = await axios.get(`${API}/drive/storage`, authConfig());
//             setStorage(sRes.data);
//         } catch (err) { navigate('/'); }
//     }, [currentFolder, activeTab, searchTerm, isVaultUnlocked, authConfig, navigate]);

//     useEffect(() => { fetchData(); }, [fetchData]);

//     const processUpload = async (file) => {
//         setUploadProgress(p => ({ ...p, [file.name]: 0 }));
//         const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
//         const total = Math.ceil(file.size / CHUNK_SIZE);
//         for (let i = 0; i < total; i++) {
//             const fd = new FormData();
//             fd.append('chunk', file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
//             fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
//             await axios.post(`${API}/upload/chunk`, fd, authConfig());
//             setUploadProgress(p => ({ ...p, [file.name]: Math.round(((i + 1) / total) * 100) }));
//         }
//         await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id || "null", isVault: activeTab === 'vault', mimeType: file.type }, authConfig());
//         fetchData();
//     };

//     const handleUpload = async (e) => {
//         const files = Array.from(e.target.files);
//         for (let i = 0; i < files.length; i += 3) { // 3 at a time
//             await Promise.all(files.slice(i, i + 3).map(f => processUpload(f)));
//         }
//     };

//     const handleAction = async (id, type, action, value) => {
//         await axios.patch(`${API}/drive/action`, { id, type, action, value }, authConfig());
//         fetchData(); setActiveMenu(null);
//     };

//     const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#fff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

//     return (
//         <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
//             <aside style={{ width: 260, borderRight: `1px solid ${theme.border}`, padding: 25, background: theme.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
//                 <h1 style={{fontSize:22, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
//                 <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('files'); setIsVaultUnlocked(false); setCurrentFolder(null); setPath([]);}}><LayoutGrid size={20}/> My Drive</div>
//                 <div style={activeTab==='shared'?styles.navAct:styles.nav} onClick={()=>setActiveTab('shared')}><Users size={20}/> Shared</div>
//                 <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>setActiveTab('starred')}><Star size={20}/> Starred</div>
//                 <div style={activeTab==='trash'?styles.navAct:styles.nav} onClick={()=>setActiveTab('trash')}><Trash2 size={20}/> Trash</div>
//                 <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={()=>setVaultModal({open:true, step:'unlock'})}><Shield size={20} color="red"/> Vault</div>
//                 <div style={{ marginTop: 'auto', padding: 15, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 12 }}>
//                     <p style={{fontSize: 11, color: isDark ? '#fff' : '#000'}}>Storage: {(storage.used/1e9).toFixed(2)}GB / 30GB</p>
//                     <div style={styles.progBg}><div style={{...styles.progFill, width: `${(storage.used/storage.limit)*100}%`}}></div></div>
//                 </div>
//             </aside>

//             <main style={{ flex: 1, padding: 30 }}>
//                 <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
//                     <div style={{...styles.searchBar, background: isDark ? '#1e293b' : '#f1f5f9'}}><Search size={18}/><input placeholder="Search..." onChange={e=>setSearchTerm(e.target.value)} style={{border:'none', background:'transparent', marginLeft:10, color:theme.text, outline:'none'}}/></div>
//                     <div style={{display:'flex', gap:15, position:'relative'}}>
//                         <button onClick={()=>setIsDark(!isDark)} style={styles.iconBtn}>{isDark?<Sun color="white"/>:<Moon/>}</button>
//                         <div style={styles.userCircle} onClick={(e)=>{e.stopPropagation(); setProfileOpen(!profileOpen)}}>{userName[0]}</div>
//                         {profileOpen && (
//                             <div style={{...styles.profileDrop, background:theme.card, border:`1px solid ${theme.border}`}}>
//                                 <button onClick={()=>{localStorage.clear(); navigate('/')}} style={{...styles.logoutBtn, color: theme.text}}><LogOut size={16}/> Sign out</button>
//                                 <button onClick={async ()=>{ if(window.confirm("Delete account?")) { await axios.delete(`${API}/auth/delete-account`, authConfig()); localStorage.clear(); navigate('/'); } }} style={{...styles.logoutBtn, color:'red'}}><UserX size={16}/> Delete Account</button>
//                             </div>
//                         )}
//                     </div>
//                 </header>

//                 <div style={{display:'flex', gap:10, marginBottom:20, alignItems:'center'}}>
//                     <span onClick={()=>{setCurrentFolder(null); setPath([]);}} style={{cursor:'pointer'}}>Root</span>
//                     {path.map((p, i) => <span key={p._id} onClick={()=>{const n=path.slice(0,i+1); setPath(n); setCurrentFolder(p);}} style={{cursor:'pointer'}}> <ChevronRight size={16}/> {p.name}</span>)}
//                     <div style={{marginLeft:'auto', display:'flex', gap:10}}>
//                         <button onClick={async ()=>{const n=prompt("Folder Name?"); if(n) await axios.post(`${API}/drive/folders`, {name:n, parentFolder:currentFolder?._id || "null", isVault:activeTab==='vault'}, authConfig()); fetchData();}} style={{...styles.btnWhite, display:'flex', gap:8}}><FolderPlus size={18}/> New Folder</button>
//                         <label style={styles.btnBlue}><Upload size={18}/> Upload <input type="file" hidden multiple webkitdirectory="true" onChange={handleUpload}/></label>
//                     </div>
//                 </div>

//                 <div style={styles.grid}>
//                     {foldersList.map(f => (
//                         <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
//                             <Folder size={48} color="#fbbf24" fill="#fbbf24"/><p>{f.name}</p>
//                             <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
//                             {activeMenu === f._id && (
//                                 <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
//                                     <div onClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}><Eye size={14}/> Open</div>
//                                     <div onClick={()=>handleAction(f._id, 'folder', 'star', !f.isStarred)}><Star size={14}/> Star</div>
//                                     <div onClick={()=>{const t=prompt("Folder ID or 'vault' or 'root'"); if(t) handleAction(f._id, 'folder', 'move', t)}}><Move size={14}/> Move</div>
//                                     <div onClick={()=>handleAction(f._id, 'folder', 'move', 'trash')} style={{color:'orange'}}><Trash2 size={14}/> Trash</div>
//                                     <div onClick={async ()=>{if(window.confirm("Permanent?")) await axios.delete(`${API}/drive/delete/folder/${f._id}`, authConfig()); fetchData();}} style={{color:'red'}}><Trash2 size={14}/> Force Delete</div>
//                                 </div>
//                             )}
//                         </div>
//                     ))}
//                     {filesList.map(f => (
//                         <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}}>
//                             <FileText size={48} color="#3b82f6"/><p>{f.fileName}</p>
//                             {uploadProgress[f.fileName] < 100 && <div style={{height:4, background:'#eee', marginTop:5}}><div style={{width:`${uploadProgress[f.fileName]}%`, height:'100%', background:'#3b82f6'}}></div></div>}
//                             <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
//                             {activeMenu === f._id && (
//                                 <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
//                                     <div onClick={async ()=>{const r=await axios.get(`${API}/drive/preview/${f._id}`, authConfig()); setPreviewFile(r.data.url)}}><Eye size={14}/> Preview</div>
//                                     <div onClick={()=>setShareModal({...f, type:'file'})}><Share2 size={14}/> Manage Access</div>
//                                     <div onClick={()=>handleAction(f._id, 'file', 'star', !f.isStarred)}><Star size={14}/> Star</div>
//                                     <div onClick={()=>{const t=prompt("Folder ID or 'vault' or 'root'"); if(t) handleAction(f._id, 'file', 'move', t)}}><Move size={14}/> Move</div>
//                                     <div onClick={()=>handleAction(f._id, 'file', 'move', 'trash')} style={{color:'orange'}}><Trash2 size={14}/> Trash</div>
//                                     <div onClick={async ()=>{if(window.confirm("Permanent?")) await axios.delete(`${API}/drive/delete/file/${f._id}`, authConfig()); fetchData();}} style={{color:'red'}}><Trash2 size={14}/> Force Delete</div>
//                                 </div>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//             </main>

//             {/* VAULT MODAL */}
//             {vaultModal.open && (
//                 <div style={styles.overlay} onClick={()=>setVaultModal({open:false})}>
//                     <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
//                         <Shield size={40} color="red" style={{margin:'0 auto 10px'}}/>
//                         {vaultModal.step === 'unlock' ? (
//                             <>
//                                 <h3>Private Vault</h3>
//                                 <input type="password" id="vpin" style={styles.pinInp} placeholder="PIN" maxLength={4}/>
//                                 <button onClick={async ()=>{ const p=document.getElementById('vpin').value; const r=await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()); if(r.data.setup) alert("PIN Set!"); setIsVaultUnlocked(true); setActiveTab('vault'); setVaultModal({open:false}); }} style={styles.btnBlue}>Unlock</button>
//                                 <p onClick={async ()=>{ await axios.post(`${API}/vault/reset-request`, {}, authConfig()); setVaultModal({open:true, step:'reset'}); }} style={{fontSize:12, marginTop:15, cursor:'pointer', color:'#3b82f6'}}>Reset PIN via Email</p>
//                             </>
//                         ) : (
//                             <>
//                                 <h3>Reset PIN</h3>
//                                 <input id="rotp" placeholder="OTP from Email" style={{...styles.pinInp, fontSize:14, letterSpacing:0}}/>
//                                 <input id="rpin" placeholder="New 4-Digit PIN" maxLength={4} style={styles.pinInp}/>
//                                 <button onClick={async ()=>{ await axios.post(`${API}/vault/reset-confirm`, {otp: document.getElementById('rotp').value, newPin: document.getElementById('rpin').value}, authConfig()); setVaultModal({open:true, step:'unlock'}); alert("PIN Updated!"); }} style={styles.btnBlue}>Update PIN</button>
//                             </>
//                         )}
//                     </div>
//                 </div>
//             )}

//             {/* SHARE MODAL */}
//             {shareModal && (
//                 <div style={styles.overlay} onClick={()=>setShareModal(null)}>
//                     <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
//                         <h3 style={{marginBottom:15}}>Manage Access</h3>
//                         <input id="semail" placeholder="User Email" style={{...styles.pinInp, fontSize:14, letterSpacing:0}}/>
//                         <select id="srole" style={{padding:10, width:'100%', marginBottom:10}}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
//                         <select id="shours" style={{padding:10, width:'100%', marginBottom:10}}><option value="0">Unlimited</option><option value="1">1 Hour</option><option value="24">24 Hours</option></select>
//                         <button onClick={async ()=>{ await axios.post(`${API}/files/share`, {id:shareModal._id, type: shareModal.type, email: document.getElementById('semail').value, role: document.getElementById('srole').value, hours: document.getElementById('shours').value}, authConfig()); setShareModal(null); alert("Shared!"); }} style={{...styles.btnBlue, width:'100%'}}>Save Permissions</button>
//                     </div>
//                 </div>
//             )}

//             {previewFile && <div style={styles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'85%', height:'85%', background:'#fff', borderRadius:15, overflow:'hidden'}}><embed src={previewFile} width="100%" height="100%"/></div></div>}
//         </div>
//     );
// };

// const styles = {
//     nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: '#64748b' },
//     navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background:'#e8f0fe', color:'#1967d2', fontWeight:'bold' },
//     btnBlue: { background:'#3b82f6', color:'#fff', padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer', display:'flex', gap:8, fontWeight:'bold', alignItems:'center' },
//     btnWhite: { border:'1px solid #dadce0', padding:10, borderRadius:8, cursor:'pointer', background:'#fff', color:'#000' },
//     grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:25 },
//     card: { padding:25, borderRadius:15, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
//     dots: { position:'absolute', top:10, right:10, cursor:'pointer' },
//     drop: { position:'absolute', top:35, right:10, borderRadius:8, padding:10, width:150, zIndex:10, display:'flex', flexDirection:'column', gap:8, fontSize:12, textAlign:'left' },
//     overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
//     modalSmall: { padding:30, borderRadius:15, width:300, textAlign:'center' },
//     pinInp: { width:'100%', padding:10, marginBottom:10, borderRadius:5, border:'1px solid #ddd', fontSize:22, textAlign:'center', letterSpacing:5 },
//     searchBar: { width: 300, padding: '10px 15px', borderRadius: 10, display:'flex', alignItems:'center' },
//     userCircle: { width:35, height:35, borderRadius:'50%', background:'#3b82f6', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:'bold' },
//     profileDrop: { position:'absolute', top:45, right:0, width:180, borderRadius:15, padding:15, zIndex:3000 },
//     logoutBtn: { background:'none', border:'none', width:'100%', textAlign:'left', padding:10, cursor:'pointer', display:'flex', gap:10, fontSize:13 },
//     progBg: { height:6, background:'#e2e8f0', borderRadius:10, marginTop:8 },
//     progFill: { height:'100%', background:'#3b82f6', borderRadius:10 },
//     iconBtn: { background:'none', border:'none', cursor:'pointer', padding:8 }
// };

// export default Drive;
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, Users, Star, Shield, LayoutGrid, Eye, Move, UserX, Fingerprint
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api"; 
const CHUNK_SIZE = 5 * 1024 * 1024;

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [path, setPath] = useState([]);
    const [activeTab, setActiveTab] = useState('files');
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [uploadProgress, setUploadProgress] = useState({});
    const [activeMenu, setActiveMenu] = useState(null);
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
    const [vaultModal, setVaultModal] = useState({ open: false, step: 'unlock' });

    const navigate = useNavigate();
    const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);

    const fetchData = useCallback(async () => {
        try {
            const fId = currentFolder ? currentFolder._id : "null";
            const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}&vaultUnlocked=${isVaultUnlocked}`, authConfig());
            setFilesList(res.data.files || []); setFoldersList(res.data.folders || []);
            const sRes = await axios.get(`${API}/drive/storage`, authConfig());
            setStorage(sRes.data);
        } catch (err) { navigate('/'); }
    }, [currentFolder, activeTab, isVaultUnlocked, authConfig, navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const processUpload = async (file) => {
        setUploadProgress(p => ({ ...p, [file.name]: 0 }));
        const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
        const total = Math.ceil(file.size / CHUNK_SIZE);
        for (let i = 0; i < total; i++) {
            const fd = new FormData();
            fd.append('chunk', file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
            fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
            await axios.post(`${API}/upload/chunk`, fd, authConfig());
            setUploadProgress(p => ({ ...p, [file.name]: Math.round(((i + 1) / total) * 100) }));
        }
        await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id || "null", isVault: activeTab === 'vault', mimeType: file.type }, authConfig());
        fetchData();
    };

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (let i = 0; i < files.length; i += 3) { // 3 files parallel
            await Promise.all(files.slice(i, i + 3).map(f => processUpload(f)));
        }
    };

    const deleteItem = async (type, id) => {
        if (!window.confirm("Delete permanently?")) return;
        await axios.delete(`${API}/drive/delete/${type}/${id}`, authConfig());
        fetchData();
    };

    const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#fff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => setActiveMenu(null)}>
            <aside style={{ width: 260, borderRight: `1px solid ${theme.border}`, padding: 25, background: theme.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h1 style={{fontSize:22, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('files'); setIsVaultUnlocked(false); setCurrentFolder(null); setPath([]);}}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab==='shared'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('shared'); setCurrentFolder(null); setPath([]);}}><Users size={20}/> Shared</div>
                <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('starred'); setCurrentFolder(null); setPath([]);}}><Star size={20}/> Starred</div>
                <div style={activeTab==='trash'?styles.navAct:styles.nav} onClick={()=>{setActiveTab('trash'); setCurrentFolder(null); setPath([]);}}><Trash2 size={20}/> Trash</div>
                <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={()=>setVaultModal({open:true, step:'unlock'})}><Shield size={20} color="red"/> Vault</div>
            </aside>

            <main style={{ flex: 1, padding: 30 }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
                    <div style={styles.breadcrumb}>
                        <span onClick={()=>{setCurrentFolder(null); setPath([]);}} style={{cursor:'pointer'}}>Root</span>
                        {path.map((p, i) => (
                            <span key={p._id} onClick={()=>{const n=path.slice(0,i+1); setPath(n); setCurrentFolder(p);}} style={{cursor:'pointer'}}>
                                <ChevronRight size={16}/> {p.name}
                            </span>
                        ))}
                    </div>
                    <div style={{display:'flex', gap:10}}>
                        <button onClick={async ()=>{const n=prompt("Name?"); if(n) await axios.post(`${API}/drive/folders`, {name:n, parentFolder:currentFolder?._id || "null", isVault:activeTab==='vault'}, authConfig()); fetchData();}} style={styles.btnWhite}><FolderPlus size={18}/> New Folder</button>
                        <label style={styles.btnBlue}><Upload size={18}/> Files<input type="file" hidden multiple onChange={handleUpload}/></label>
                        <label style={styles.btnBlue}><FolderPlus size={18}/> Folder<input type="file" hidden webkitdirectory="true" onChange={handleUpload}/></label>
                    </div>
                </header>

                <div style={styles.grid}>
                    {foldersList.map(f => (
                        <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
                            <Folder size={48} color="#fbbf24" fill="#fbbf24"/><p>{f.name}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>Open</div>
                                    <div onClick={()=>deleteItem('folder', f._id)} style={{color:'red'}}>Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                    {filesList.map(f => (
                        <div key={f._id} style={{...styles.card, background:theme.card, borderColor:theme.border}}>
                            <FileText size={48} color="#3b82f6"/><p>{f.fileName}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={()=>deleteItem('file', f._id)} style={{color:'red'}}>Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {/* Modals same as previous */}
        </div>
    );
};

const styles = {
    nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: '#64748b' },
    navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background:'#e8f0fe', color:'#1967d2', fontWeight:'bold' },
    btnBlue: { background:'#3b82f6', color:'#fff', padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer', display:'flex', gap:8, fontWeight:'bold', alignItems:'center' },
    btnWhite: { border:'1px solid #dadce0', padding:'10px 20px', borderRadius:8, cursor:'pointer', background:'#fff', color:'#000', display:'flex', gap:8 },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:25 },
    card: { padding:25, borderRadius:15, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:10, right:10, cursor:'pointer' },
    drop: { position:'absolute', top:35, right:10, borderRadius:8, padding:10, width:130, zIndex:10, display:'flex', flexDirection:'column', gap:8, fontSize:12, textAlign:'left' },
    breadcrumb: { display:'flex', gap:10, fontSize:18, color:'#94a3b8', cursor:'pointer', alignItems:'center' }
};

export default Drive;