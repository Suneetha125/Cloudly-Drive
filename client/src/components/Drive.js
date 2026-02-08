import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move, UserX
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";
const CONCURRENCY_LIMIT = 3; 

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [activeTab, setActiveTab] = useState('files');
    const [path, setPath] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [vaultModal, setVaultModal] = useState(null);
    const [moveModal, setMoveModal] = useState(null);
    const [shareModal, setShareModal] = useState(null);

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

    // --- OPTIMIZED PARALLEL UPLOAD ---
    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (let file of files) {
            const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
            const chunks = [];
            const size = 5 * 1024 * 1024;
            for (let i = 0; i < Math.ceil(file.size / size); i++) {
                const fd = new FormData();
                fd.append('chunk', file.slice(i * size, (i + 1) * size));
                fd.append('uploadId', init.data.uploadId); fd.append('fileName', file.name);
                chunks.push(fd);
            }
            // Execute in parallel batches
            for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
                await Promise.all(chunks.slice(i, i + CONCURRENCY_LIMIT).map(c => axios.post(`${API}/upload/chunk`, c, authConfig())));
            }
            await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId: init.data.uploadId, folderId: currentFolder?._id, isVault: activeTab === 'vault' }, authConfig());
        }
        fetchData();
    };

    const handleBiometric = () => {
        alert("Simulating Fingerprint Scan...");
        setTimeout(() => { setVaultModal(null); setActiveTab('vault'); }, 1000);
    };

    const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#ffffff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => setActiveMenu(null)}>
            <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: 25, display: 'flex', flexDirection: 'column', gap: 10, background: theme.card }}>
                <h1 style={{fontSize:22, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>setActiveTab('files')}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={async ()=>{ const res = await axios.get(`${API}/vault/status`, authConfig()); setVaultModal({ setup: !res.data.hasPIN }); }}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={styles.storageBox}>
                    <p style={{fontSize:11}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / 30GB</p>
                    <div style={styles.bar}><div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, padding: 30, overflowY: 'auto' }}>
                <div style={styles.toolbar}>
                    <div style={styles.breadcrumb}>
                        <span onClick={()=>{setCurrentFolder(null); setPath([])}} style={{cursor:'pointer'}}>My Drive</span>
                        {path.map((p, i) => <span key={`bread-${p._id}`} onClick={()=>{const n=path.slice(0,i+1); setPath(n); setCurrentFolder(p);}} style={{cursor:'pointer'}}> <ChevronRight size={16} style={{display:'inline'}}/> {p.name}</span>)}
                    </div>
                    <div style={{display:'flex', gap:10}}>
                        <label style={styles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                        <button onClick={async ()=>{ if(window.confirm("Delete account?")) { await axios.delete(`${API}/auth/delete-account`, authConfig()); localStorage.clear(); navigate('/'); } }} style={styles.btnWhite}><UserX size={18}/></button>
                    </div>
                </div>

                <div style={styles.grid}>
                    {foldersList.map(f => (
                        <div key={`folder-${f._id}`} style={{...styles.card, background:theme.card, borderColor:theme.border}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
                            <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                            <p style={{marginTop:10, fontWeight:'600'}}>{f.name}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={(e)=>{e.stopPropagation(); axios.patch(`${API}/drive/star/folder/${f._id}`,{},authConfig()).then(fetchData)}}><Star size={14}/> Star</div>
                                    <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/folders/${f._id}`,authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                    {filesList.map(f => (
                        <div key={`file-${f._id}`} style={{...styles.card, background:theme.card, borderColor:theme.border}}>
                            <FileText size={48} color={theme.accent}/>
                            <p style={{marginTop:10, fontSize:13}}>{f.fileName}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/files/preview/${f._id}`, authConfig()).then(res => setPreviewFile(res.data.url))}}><Eye size={14}/> Open</div>
                                    <div onClick={(e)=>{e.stopPropagation(); setShareModal(f)}}><Share2 size={14}/> Share</div>
                                    <div onClick={(e)=>{e.stopPropagation(); setMoveModal(f)}}><Move size={14}/> Move</div>
                                    <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); axios.delete(`${API}/files/${f._id}`,authConfig()).then(fetchData)}}><Trash2 size={14}/> Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {vaultModal && (
                <div style={styles.overlay} onClick={()=>setVaultModal(null)}>
                    <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
                        <Shield size={48} color="red" style={{margin:'0 auto 20px', display:'block'}}/>
                        <h3>{vaultModal.setup ? "Setup Vault" : "Unlock Vault"}</h3>
                        <input type="password" id="vpin" maxLength={4} style={styles.pinInput} placeholder="****" />
                        <button onClick={async ()=>{ const p=document.getElementById('vpin').value; await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()); setVaultModal(null); setActiveTab('vault'); }} style={styles.btnBluePro}>Unlock</button>
                        <button onClick={handleBiometric} style={{...styles.btnWhitePro, marginTop:10, width:'100%'}}><Fingerprint size={20}/> Use Fingerprint</button>
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
    btnBlue: { background:'#1a73e8', color:'#fff', padding:'12px 24px', borderRadius:24, cursor:'pointer', display:'flex', gap:10, fontWeight:'500', border:'none' },
    btnWhite: { background:'transparent', border:'1px solid #dadce0', padding:10, borderRadius:'50%', cursor:'pointer' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25 },
    card: { padding:25, borderRadius:16, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:15, right:15, color:'#5f6368', cursor:'pointer' },
    drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:10, width:140, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
    modalSmall: { width:350, padding:30, borderRadius:20 },
    pinInput: { width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:15, textAlign:'center', fontSize:24, letterSpacing:10 },
    storageBox: { marginTop: 'auto', padding: '20px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', color: '#000' },
    bar: { height:6, background:'#eee', borderRadius:10, marginTop:10, overflow:'hidden' },
    toolbar: { display:'flex', justifyContent:'space-between', marginBottom:30, alignItems:'center' },
    breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18 }
};

export default Drive;