import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Move, Download
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";

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

    const handleAction = async (e, method, url, data = {}) => {
        e.stopPropagation(); // STOP BUBBLING
        try {
            await axios({ method, url: `${API}/drive/${url}`, data, ...authConfig() });
            setActiveMenu(null);
            fetchData();
        } catch (err) { alert("Action failed"); }
    };

    const handlePreview = async (e, f) => {
        e.stopPropagation();
        const res = await axios.get(`${API}/drive/preview/${f._id}`, authConfig());
        setPreviewFile(res.data.url);
    };

    const theme = { bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#fff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => setActiveMenu(null)}>
            {/* Sidebar */}
            <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: 25, display: 'flex', flexDirection: 'column', gap: 10, background: theme.card }}>
                <h1 style={{fontSize:20, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab==='files'?styles.navAct:styles.nav} onClick={()=>setActiveTab('files')}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab==='starred'?styles.navAct:styles.nav} onClick={()=>setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={activeTab==='shared'?styles.navAct:styles.nav} onClick={()=>setActiveTab('shared')}><Users size={20}/> Shared</div>
                <div style={activeTab==='vault'?styles.navAct:styles.nav} onClick={()=>setActiveTab('vault')}><Shield size={20} color="red"/> Vault</div>
                
                <div style={{ marginTop: 'auto', padding: 15, background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 12 }}>
                    <p style={{fontSize: 11}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / 30GB</p>
                    <div style={styles.progBg}><div style={{...styles.progFill, width: `${(storage.used/storage.limit)*100}%`}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, padding: 30 }}>
                <div style={styles.toolbar}>
                    <div style={styles.breadcrumb}>My Drive {path.map(p => ` / ${p.name}`)}</div>
                    <div style={{display:'flex', gap:10}}>
                        <button onClick={()=>setIsDark(!isDark)} style={styles.btnWhite}>{isDark?<Sun/>:<Moon/>}</button>
                        <button onClick={()=>{localStorage.clear(); navigate('/')}} style={styles.btnWhite}><LogOut/></button>
                    </div>
                </div>

                <div style={styles.grid}>
                    {foldersList.map(f => (
                        <div key={`f-${f._id}`} style={{...styles.card, background:theme.card, borderColor:theme.border}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
                            <Folder size={48} color="#fbbf24" fill="#fbbf24"/><p>{f.name}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={(e)=>handleAction(e, 'patch', `star/folder/${f._id}`)}><Star size={14}/> Star</div>
                                    <div style={{color:'red'}} onClick={(e)=>handleAction(e, 'delete', `delete/folder/${f._id}`)}><Trash2 size={14}/> Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                    {filesList.map(f => (
                        <div key={`fi-${f._id}`} style={{...styles.card, background:theme.card, borderColor:theme.border}}>
                            <FileText size={48} color={theme.accent}/><p>{f.fileName}</p>
                            <MoreVertical style={styles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(f._id)}}/>
                            {activeMenu === f._id && (
                                <div style={{...styles.drop, background:theme.card, border:`1px solid ${theme.border}`}}>
                                    <div onClick={(e)=>handlePreview(e, f)}><Eye size={14}/> Open</div>
                                    <div onClick={(e)=>{e.stopPropagation(); setShareModal(f)}}><Share2 size={14}/> Share</div>
                                    <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Folder ID:"); tid && handleAction(e, 'patch', 'move', {fileId:f._id, targetId:tid})}}><Move size={14}/> Move</div>
                                    <div onClick={(e)=>handleAction(e, 'patch', `star/file/${f._id}`)}><Star size={14}/> Star</div>
                                    <div style={{color:'red'}} onClick={(e)=>handleAction(e, 'delete', `delete/${f._id}`)}><Trash2 size={14}/> Delete</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            {shareModal && (
                <div style={styles.overlay} onClick={()=>setShareModal(null)}>
                    <div style={{...styles.modalSmall, background:theme.card}} onClick={e=>e.stopPropagation()}>
                        <h3>Share Access</h3>
                        <input id="semail" placeholder="Email" style={styles.inp}/>
                        <select id="shours" style={styles.inp}><option value="0">Permanent</option><option value="1">1 Hour</option><option value="24">24 Hours</option></select>
                        <button onClick={(e)=>handleAction(e, 'post', 'share', {fileId:shareModal._id, email:document.getElementById('semail').value, hours:document.getElementById('shours').value}).then(()=>setShareModal(null))} style={styles.btnBlue}>Grant Access</button>
                    </div>
                </div>
            )}

            {previewFile && <div style={styles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'80%', height:'80%'}}><embed src={previewFile} width="100%" height="100%"/></div></div>}
        </div>
    );
};

const styles = {
    nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: '#64748b' },
    navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background:'#e8f0fe', color:'#1967d2', fontWeight:'bold' },
    btnBlue: { background:'#3b82f6', color:'#fff', padding:'10px 20px', borderRadius:8, cursor:'pointer', border:'none', fontWeight:'bold', width:'100%', marginTop:10 },
    btnWhite: { border:'1px solid #e2e8f0', padding:10, borderRadius:8, cursor:'pointer', background:'#fff' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:25 },
    card: { padding:25, borderRadius:15, border:'1px solid', textAlign:'center', position:'relative', cursor:'pointer' },
    dots: { position:'absolute', top:15, right:15, cursor:'pointer' },
    drop: { position:'absolute', top:40, right:15, padding:12, borderRadius:8, width:140, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, display:'flex', flexDirection:'column', gap:10, textAlign:'left' },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
    modalSmall: { padding:30, borderRadius:15, width:320, textAlign:'center' },
    inp: { width:'100%', padding:10, borderRadius:8, border:'1px solid #ddd', marginBottom:10, background:'transparent' },
    progBg: { height: 6, background: '#eee', borderRadius: 10, marginTop: 10 },
    progFill: { height: '100%', background: '#3b82f6', borderRadius: 10 },
    toolbar: { display:'flex', justifyContent:'space-between', marginBottom:30, alignItems:'center' },
    breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18 }
};

export default Drive;