import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move, UserX
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";
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
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [moveModal, setMoveModal] = useState(null);
    const [vaultModal, setVaultModal] = useState(false);
    const [shareModal, setShareModal] = useState(null);
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

    const handleBiometric = () => {
        alert("Simulating Fingerprint Scan...");
        setTimeout(() => { setVaultModal(false); setActiveTab('vault'); }, 1000);
    };

    const jumpToFolder = (index) => {
        if (index === -1) { setCurrentFolder(null); setPath([]); }
        else { const newPath = path.slice(0, index + 1); setCurrentFolder(newPath[index]); setPath(newPath); }
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
                <div style={activeTab === 'vault' ? styles.navActive : styles.navItem} onClick={async ()=>{ const res = await axios.get(`${API}/vault/status`, authConfig()); setVaultModal({ setup: !res.data.hasPIN }); }}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={{ marginTop: 'auto', padding: '20px', background: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, color: '#000' }}>
                    <p style={{fontSize:12}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / 30GB</p>
                    <div style={styles.bar}><div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: '80px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={styles.searchBar}><Search size={18} color="#94a3b8"/><input placeholder="Search files..." style={{border:'none', background:'transparent', marginLeft:15, width:'100%', outline:'none', color:theme.text}} /></div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', position:'relative' }}>
                        <button onClick={(e)=>{e.stopPropagation(); setIsDark(!isDark); localStorage.setItem('theme', !isDark?'dark':'light')}} style={styles.iconBtn}>{isDark?<Sun/>:<Moon/>}</button>
                        <div style={styles.userCircle} onClick={(e)=>{e.stopPropagation(); setProfileOpen(!profileOpen)}}>{userName[0]}</div>
                        {profileOpen && (
                            <div style={{...styles.profileDrop, backgroundColor:theme.card, border:`1px solid ${theme.border}`}}>
                                <p style={{fontWeight:'bold'}}>Hi, {userName}!</p>
                                <button onClick={async ()=>{ if(window.confirm("Delete account?")) { await axios.delete(`${API}/auth/delete-account`, authConfig()); localStorage.clear(); navigate('/'); } }} style={{...styles.logoutBtn, color:'red'}}><UserX size={16}/> Delete Account</button>
                                <button onClick={()=>{localStorage.clear(); navigate('/')}} style={styles.logoutBtn}><LogOut size={16}/> Sign out</button>
                            </div>
                        )}
                    </div>
                </header>

                <div style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
                    <div style={styles.breadcrumb}>
                        <span onClick={() => jumpToFolder(-1)} style={{cursor:'pointer'}}>My Drive</span>
                        {path.map((p, i) => <span key={p._id} onClick={() => jumpToFolder(i)} style={{cursor:'pointer'}}> <ChevronRight size={16} style={{display:'inline'}}/> {p.name}</span>)}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            <label style={styles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                        </div>
                    </div>

                    <div style={styles.grid}>
                        {foldersList.map(f => (
                            <div key={`folder-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}} onDoubleClick={() => {setPath([...path, f]); setCurrentFolder(f)}}>
                                <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                                <p style={{marginTop:15, fontWeight:'600'}}>{f.name}</p>
                            </div>
                        ))}
                        {filesList.map(f => (
                            <div key={`file-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}}>
                                <FileText size={48} color={theme.accent}/>
                                <p style={{marginTop:15, fontWeight:'500', fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.fileName}</p>
                                <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                                {activeMenu === f._id && (
                                    <div style={{...styles.drop, backgroundColor: theme.card, border:`1px solid ${theme.border}`}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/files/preview/${f._id}`, authConfig()).then(res => setPreviewFile(res.data.url))}}><Eye size={14}/> Open</div>
                                        <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Target Folder ID:"); axios.patch(`${API}/files/move`, {fileId:f._id, targetId:tid}, authConfig()).then(fetchData)}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/files/${f._id}`, authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {vaultModal && (
                <div style={styles.overlay} onClick={()=>setVaultModal(false)}>
                    <div style={{...styles.modalSmall, backgroundColor: theme.card}} onClick={e=>e.stopPropagation()}>
                        <Shield size={48} color="#ef4444" style={{margin:'0 auto 20px', display:'block'}}/>
                        <h3>{vaultModal.setup ? "Setup Vault PIN" : "Unlock Vault"}</h3>
                        <input type="password" id="vpin" maxLength={4} style={styles.pinInput} placeholder="****" />
                        <button onClick={async ()=>{ const p=document.getElementById('vpin').value; await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()); setVaultModal(false); setActiveTab('vault'); }} style={styles.btnBluePro}>Unlock</button>
                        <button onClick={handleBiometric} style={{...styles.btnWhitePro, marginTop:10, width:'100%'}}><Fingerprint size={20}/> Use Fingerprint</button>
                    </div>
                </div>
            )}

            {previewFile && <div style={styles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'80%', height:'80%'}}><embed src={previewFile} width="100%" height="100%"/></div></div>}
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
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25, marginTop:30 },
    card: { padding:25, borderRadius:16, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:15, right:15, color:'#5f6368', cursor:'pointer' },
    drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:10, width:140, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
    profileDrop: { position:'absolute', top:45, right:0, width:220, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:20 },
    logoutBtn: { background:'none', border:'1px solid #dadce0', padding:'10px 15px', borderRadius:10, cursor:'pointer', width:'100%', marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:12 },
    storageBox: { marginTop: 'auto', padding: '20px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', color: '#000' },
    bar: { height:6, background:'#eee', borderRadius:10, marginTop:10, overflow:'hidden' },
    pinInput: { width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:15, textAlign:'center', fontSize:24, letterSpacing:10 },
    searchBar: { background: '#fff', width: '500px', padding: '12px 20px', borderRadius: '12px', display:'flex', alignItems:'center', border:'1px solid #e2e8f0' },
    breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18, marginBottom:30 },
    iconBtn: { background:'none', border:'none', cursor:'pointer', color:'inherit', padding:8 }
};

export default Drive;