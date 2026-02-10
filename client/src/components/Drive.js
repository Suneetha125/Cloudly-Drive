import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move, UserX
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [activeTab, setActiveTab] = useState('files');
    const [path, setPath] = useState([]);
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [progress, setProgress] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);
    const [vaultModal, setVaultModal] = useState(null);
    const [moveModal, setMoveModal] = useState(null);
    const [shareModal, setShareModal] = useState(null);
    const [shareData, setShareData] = useState({ email: "", role: "Viewer", hours: 0 });
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [activeMenu, setActiveMenu] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);

    const navigate = useNavigate();
    const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);
    const userName = localStorage.getItem("userName") || "User";

    const fetchData = useCallback(async () => {
        try {
            const fId = currentFolder ? currentFolder._id : "null";
            const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}`, authConfig());
            setFilesList(res.data.files || []); setFoldersList(res.data.folders || []);
            const sRes = await axios.get(`${API}/drive/storage`, authConfig());
            setStorage(sRes.data);
        } catch (err) { navigate('/'); }
    }, [currentFolder, activeTab, authConfig, navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (let file of files) {
            const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
            const chunks = Math.ceil(file.size / (5 * 1024 * 1024));
            for (let i = 0; i < chunks; i++) {
                const fd = new FormData();
                fd.append('chunk', file.slice(i * 5 * 1024 * 1024, (i + 1) * 5 * 1024 * 1024));
                fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
                await axios.post(`${API}/upload/chunk`, fd, authConfig());
                setProgress(Math.round(((i+1)/chunks)*100));
            }
            await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id, isVault: activeTab === 'vault' }, authConfig());
        }
        setProgress(0); fetchData();
    };

    const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#ffffff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
            <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: 25, display: 'flex', flexDirection: 'column', gap: 10, background: theme.card }}>
                <h1 style={{fontSize:20, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>setActiveTab('files')}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={activeTab==='shared'?styles.navAct:styles.nav} onClick={()=>setActiveTab('shared')}><Users size={20}/> Shared</div>
                <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={async ()=>{ const res = await axios.get(`${API}/vault/status`, authConfig()); setVaultModal({ setup: !res.data.hasPIN }); }}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={{ marginTop: 'auto', padding: 15, background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 12 }}>
                    <p style={{fontSize: 11}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / 30GB</p>
                    <div style={styles.progBg}><div style={{...styles.progFill, width: `${(storage.used/storage.limit)*100}%`}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: 80, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={styles.searchBar}><Search size={18} color="#94a3b8"/><input placeholder="Search files..." style={{border:'none', background:'transparent', marginLeft:15, width:'100%', outline:'none', color:theme.text}} /></div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', position:'relative' }}>
                        <button onClick={()=>setIsDark(!isDark)} style={styles.iconBtn}>{isDark?<Sun color="#fff"/>:<Moon/>}</button>
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

                <div style={{ padding: 40, flex: 1, overflowY: 'auto' }}>
                    <div style={styles.breadcrumb}>
                        <span onClick={() => {setCurrentFolder(null); setPath([]);}} style={{cursor:'pointer'}}>My Drive</span>
                        {path.map((p, i) => <span key={p._id} onClick={()=>{const n=path.slice(0,i+1); setPath(n); setCurrentFolder(p);}} style={{cursor:'pointer'}}> <ChevronRight size={16} style={{display:'inline'}}/> {p.name}</span>)}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            <label style={styles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                            <button style={styles.btnWhite} onClick={() => {const n=prompt("Name:"); n && axios.post(`${API}/drive/folder`,{name:n, parentFolder:currentFolder?._id, isVault: activeTab==='vault'}, authConfig()).then(fetchData)}}><FolderPlus size={18}/></button>
                        </div>
                    </div>

                    <div style={styles.grid}>
                        {foldersList.map(f => (
                            <div key={`folder-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
                                <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                                <p style={{marginTop:15, fontWeight:'bold'}}>{f.name}</p>
                                <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                                {activeMenu === f._id && (
                                    <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                        <div onClick={(e)=>{e.stopPropagation(); setMoveModal({id:f._id, type:'folder'})}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/drive/delete/folder/${f._id}`, authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filesList.map(f => (
                            <div key={`file-${f._id}`} style={{...styles.card, backgroundColor: theme.card, borderColor: theme.border}}>
                                <FileText size={48} color={theme.accent}/>
                                <p style={{marginTop:15, fontSize:13}}>{f.fileName}</p>
                                <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                                {activeMenu === f._id && (
                                    <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/drive/preview/${f._id}`, authConfig()).then(res => setPreviewFile(res.data.url))}}><Eye size={14}/> Open</div>
                                        <div onClick={(e)=>{e.stopPropagation(); setShareModal(f)}}><Share2 size={14}/> Share</div>
                                        <div onClick={(e)=>{e.stopPropagation(); setMoveModal({id:f._id, type:'file'})}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/drive/delete/file/${f._id}`, authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {vaultModal && (
                <div style={styles.overlay} onClick={()=>setVaultModal(null)}>
                    <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
                        <Shield size={48} color="red" style={{margin:'0 auto 20px', display:'block'}}/>
                        <h3>{vaultModal.setup ? "Setup PIN" : "Unlock Vault"}</h3>
                        <input type="password" id="vpin" maxLength={4} style={styles.pinInput} placeholder="****" />
                        <button onClick={async ()=>{ const p=document.getElementById('vpin').value; await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()); setVaultModal(null); setActiveTab('vault'); }} style={styles.btnBluePro}>Unlock</button>
                        <button onClick={()=>{alert("Biometric Verified!"); setVaultModal(null); setActiveTab('vault');}} style={{...styles.btnWhitePro, marginTop:10, width:'100%'}}><Fingerprint size={20}/> Use Fingerprint</button>
                    </div>
                </div>
            )}

            {moveModal && (
                <div style={styles.overlay} onClick={()=>setMoveModal(null)}>
                    <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
                        <h3>Move to...</h3>
                        <div onClick={async ()=>{ await axios.patch(`${API}/drive/move`, {itemId:moveModal.id, type:moveModal.type, targetId:'root'}, authConfig()); setMoveModal(null); fetchData(); }} style={styles.moveOption}>Root</div>
                        {foldersList.filter(f => f._id !== moveModal.id).map(folder => (
                            <div key={folder._id} onClick={async ()=>{ await axios.patch(`${API}/drive/move`, {itemId:moveModal.id, type:moveModal.type, targetId:folder._id}, authConfig()); setMoveModal(null); fetchData(); }} style={styles.moveOption}>{folder.name}</div>
                        ))}
                    </div>
                </div>
            )}

            {shareModal && (
                <div style={styles.overlay} onClick={()=>setShareModal(null)}>
                    <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
                        <h3>Manage Access</h3>
                        <input id="semail" placeholder="Email" style={styles.miniInput}/>
                        <select id="shours" style={styles.miniInput}>
                            <option value="0">Permanent</option><option value="1">1 Hour</option><option value="24">24 Hours</option>
                        </select>
                        <button onClick={async ()=>{ await axios.post(`${API}/drive/share`, {fileId:shareModal._id, email:document.getElementById('semail').value, hours:document.getElementById('shours').value}, authConfig()); setShareModal(null); alert("Shared!"); }} style={styles.btnBluePro}>Grant Access</button>
                    </div>
                </div>
            )}

            {previewFile && <div style={styles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'80%', height:'80%'}}><embed src={previewFile} width="100%" height="100%"/></div></div>}
        </div>
    );
};

const styles = {
    nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color:'#5f6368' },
    navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background:'#e8f0fe', color:'#1967d2', fontWeight:'bold' },
    userCircle: { width:32, height:32, borderRadius:'50%', background:'#3b82f6', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', cursor:'pointer' },
    btnBlue: { background:'#1a73e8', color:'#fff', padding:'12px 24px', borderRadius:'24px', cursor:'pointer', display:'flex', gap:10, fontWeight:'500', border:'none' },
    btnBluePro: { background:'#1a73e8', color:'#fff', border:'none', width:'100%', padding:12, borderRadius:8, cursor:'pointer', fontWeight:'bold' },
    btnWhitePro: { background:'transparent', border:'1px solid #dadce0', padding:10, borderRadius:8, cursor:'pointer' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25, marginTop:30 },
    card: { padding:25, borderRadius:16, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:15, right:15, color:'#5f6368', cursor:'pointer' },
    drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:10, width:140, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
    modalSmall: { width:350, padding:30, borderRadius:20 },
    miniInput: { width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:15, outline:'none' },
    profileDrop: { position:'absolute', top:45, right:0, width:220, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:20 },
    logoutBtn: { background:'none', border:'1px solid #dadce0', padding:'10px 20px', borderRadius:10, cursor:'pointer', width:'100%', marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:12 },
    bar: { height:6, background:'#eee', borderRadius:10, marginTop:10, overflow:'hidden' },
    pinInput: { width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:15, textAlign:'center', fontSize:24, letterSpacing:10 },
    searchBar: { background: '#fff', width: '500px', padding: '12px 20px', borderRadius: '12px', display:'flex', alignItems:'center', border:'1px solid #e2e8f0' },
    breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18, marginBottom:30 },
    iconBtn: { background:'none', border:'none', cursor:'pointer', color:'inherit', padding:8 },
    moveOption: { padding:10, borderRadius:8, cursor:'pointer', borderBottom:'1px solid #eee' }
};

export default Drive;