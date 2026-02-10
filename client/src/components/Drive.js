import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, Users, Star, Shield, LayoutGrid, Eye, Move, Download, UserX 
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api"; 
const CHUNK_SIZE = 5 * 1024 * 1024;

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [activeTab, setActiveTab] = useState('files');
    const [pathHistory, setPathHistory] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [showShareModal, setShowShareModal] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareForm, setShareForm] = useState({ email: '', role: 'viewer', hours: 0 });
    const [uploadProgress, setUploadProgress] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

    const navigate = useNavigate();
    const authConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);
    const userName = localStorage.getItem("userName") || "User";

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/drive/contents`, {
                headers: authConfig().headers,
                params: { folderId: currentFolder?._id || "null", tab: activeTab, search: searchTerm, vaultUnlocked: isVaultUnlocked }
            });
            setFilesList(res.data.files || []); 
            setFoldersList(res.data.folders || []);
            const sRes = await axios.get(`${API}/drive/storage`, authConfig());
            setStorage(sRes.data);
        } catch (err) { if (err.response?.status === 401) navigate('/'); }
    }, [currentFolder, activeTab, authConfig, navigate, searchTerm, isVaultUnlocked]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            try {
                setUploadProgress(p => ({ ...p, [file.name]: 0 }));
                const init = await axios.post(`${API}/upload/initialize`, {}, authConfig());
                const { uploadId } = init.data;
                let uploaded = 0;
                while (uploaded < file.size) {
                    const chunk = file.slice(uploaded, uploaded + CHUNK_SIZE);
                    const fd = new FormData();
                    fd.append('chunk', chunk); fd.append('uploadId', uploadId); fd.append('fileName', file.name);
                    await axios.post(`${API}/upload/chunk`, fd, authConfig());
                    uploaded += chunk.size;
                    setUploadProgress(p => ({ ...p, [file.name]: Math.min(99, Math.round((uploaded / file.size) * 100)) }));
                }
                await axios.post(`${API}/upload/complete`, { fileName: file.name, uploadId, folderId: currentFolder?._id || "null", isVault: activeTab === 'vault', mimeType: file.type }, authConfig());
                setUploadProgress(p => ({ ...p, [file.name]: 100 }));
                fetchData();
            } catch (err) { console.error(err); }
        }
    };

    const handleAction = async (method, url, data = {}) => {
        try {
            await axios({ method, url: `${API}${url}`, data, ...authConfig() });
            fetchData();
            setActiveMenu(null);
        } catch (e) { alert("Action Failed"); }
    };

    const theme = { 
        bg: isDark ? '#0f172a' : '#f8fafc', card: isDark ? '#1e293b' : '#ffffff', text: isDark ? '#f1f5f9' : '#1e293b', border: isDark ? '#334155' : '#e2e8f0', accent: '#3b82f6'
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
            {/* SIDEBAR */}
            <aside style={{ width: 260, borderRight: `1px solid ${theme.border}`, padding: 20, background: theme.card, display:'flex', flexDirection:'column', gap:10 }}>
                <h1 style={{fontSize:22, fontWeight:'bold', marginBottom:20}}>Cloudly</h1>
                <div style={{display:'flex', gap:12, padding:12, cursor:'pointer', borderRadius:8, background: activeTab === 'files' ? theme.accent : 'transparent', color: activeTab === 'files' ? '#fff' : theme.text}} onClick={() => {setActiveTab('files'); setCurrentFolder(null); setPathHistory([]); setIsVaultUnlocked(false)}}><LayoutGrid size={20}/> My Drive</div>
                <div style={{display:'flex', gap:12, padding:12, cursor:'pointer', borderRadius:8, background: activeTab === 'shared' ? theme.accent : 'transparent', color: activeTab === 'shared' ? '#fff' : theme.text}} onClick={() => setActiveTab('shared')}><Users size={20}/> Shared</div>
                <div style={{display:'flex', gap:12, padding:12, cursor:'pointer', borderRadius:8, background: activeTab === 'starred' ? theme.accent : 'transparent', color: activeTab === 'starred' ? '#fff' : theme.text}} onClick={() => setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={{display:'flex', gap:12, padding:12, cursor:'pointer', borderRadius:8, background: activeTab === 'vault' ? theme.accent : 'transparent', color: activeTab === 'vault' ? '#fff' : theme.text}} onClick={async ()=>{
                    const p = prompt("Vault PIN:");
                    if(p) try { await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig()); setIsVaultUnlocked(true); setActiveTab('vault'); setCurrentFolder(null); setPathHistory([]); } catch(e) { alert("Wrong PIN"); }
                }}><Shield size={20}/> Vault</div>
                
                <div style={{marginTop:'auto', paddingTop:20, borderTop:`1px solid ${theme.border}`}}>
                    <p style={{fontSize:12}}>Storage: {(storage.used/1e9).toFixed(2)} / 30GB</p>
                    <div style={{height:6, background:theme.border, borderRadius:10, marginTop:5, overflow:'hidden'}}>
                        <div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: 70, padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ background: theme.card, width: 400, padding: '10px 15px', borderRadius: 10, display:'flex', alignItems:'center', border:`1px solid ${theme.border}` }}>
                        <Search size={18}/><input placeholder="Search..." style={{border:'none', background:'transparent', marginLeft:10, width:'100%', color:theme.text, outline:'none'}} onChange={e=>setSearchTerm(e.target.value)}/>
                    </div>
                    <div style={{display:'flex', gap:20, alignItems:'center', position:'relative'}}>
                        <button onClick={()=>setIsDark(!isDark)} style={{background:'none', border:'none', cursor:'pointer', color:theme.text}}>{isDark ? <Sun/> : <Moon/>}</button>
                        <div style={{width:35, height:35, borderRadius:'50%', background:theme.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:'bold'}} onClick={(e)=>{e.stopPropagation(); setProfileOpen(!profileOpen)}}>{userName[0]}</div>
                        {profileOpen && (
                            <div style={{position:'absolute', top:50, right:0, background:theme.card, border:`1px solid ${theme.border}`, borderRadius:12, width:180, padding:10, zIndex:100, boxShadow:'0 10px 15px rgba(0,0,0,0.1)'}}>
                                <p style={{padding:'10px', fontSize:14, fontWeight:'bold', borderBottom:`1px solid ${theme.border}`}}>{userName}</p>
                                <button onClick={()=>{localStorage.clear(); navigate('/')}} style={{width:'100%', textAlign:'left', padding:10, background:'none', border:'none', color:theme.text, display:'flex', gap:10, cursor:'pointer'}}><LogOut size={16}/> Sign out</button>
                                <button onClick={async ()=>{if(window.confirm("Delete Account? Irreversible!")) { await axios.delete(`${API}/auth/delete-account`, authConfig()); localStorage.clear(); navigate('/'); }}} style={{width:'100%', textAlign:'left', padding:10, background:'none', border:'none', color:'red', display:'flex', gap:10, cursor:'pointer'}}><UserX size={16}/> Delete Account</button>
                            </div>
                        )}
                    </div>
                </header>

                <div style={{ padding: 30, flex:1, overflowY:'auto' }}>
                    <div style={{display:'flex', gap:10, marginBottom:20, alignItems:'center'}}>
                        <span onClick={()=>{setCurrentFolder(null); setPathHistory([])}} style={{cursor:'pointer'}}>Drive</span>
                        {pathHistory.map((h, i)=>(<span key={i}><ChevronRight size={16}/> <span style={{cursor:'pointer'}} onClick={()=>{setCurrentFolder(h); setPathHistory(pathHistory.slice(0, i))}}>{h?.name}</span></span>))}
                        {currentFolder && <><ChevronRight size={16}/> <span>{currentFolder.name}</span></>}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            <label style={{background:theme.accent, color:'#fff', padding:'8px 16px', borderRadius:20, cursor:'pointer', display:'flex', gap:8}}><Upload size={18}/> Files<input type="file" hidden multiple onChange={handleUpload}/></label>
                            <label style={{background:theme.card, color:theme.text, border:`1px solid ${theme.border}`, padding:'8px 16px', borderRadius:20, cursor:'pointer', display:'flex', gap:8}}><FolderPlus size={18}/> Folder<input type="file" hidden webkitdirectory="true" onChange={handleUpload}/></label>
                        </div>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:20 }}>
                        {foldersList.map(f => (
                            <div key={f._id} style={{padding:20, background:theme.card, borderRadius:12, border:`1px solid ${theme.border}`, textAlign:'center', position:'relative'}} onDoubleClick={()=>{setPathHistory([...pathHistory, currentFolder].filter(Boolean)); setCurrentFolder(f)}}>
                                <Folder size={40} color="#fbbf24" fill="#fbbf24" style={{margin:'0 auto'}}/>
                                <p style={{marginTop:10, fontWeight:'500'}}>{f.name}</p>
                                <MoreVertical style={{position:'absolute', top:10, right:10, cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`f-${f._id}`)}}/>
                                {activeMenu === `f-${f._id}` && (
                                    <div style={{position:'absolute', top:35, right:10, background:theme.card, border:`1px solid ${theme.border}`, zIndex:10, borderRadius:8, width:150, padding:8, display:'flex', flexDirection:'column', gap:8}}>
                                        <div onClick={()=>{setPathHistory([...pathHistory, currentFolder].filter(Boolean)); setCurrentFolder(f)}}><Eye size={14}/> Open</div>
                                        <div onClick={()=>{const t=prompt("Move to? root, vault, starred, or FolderID"); t && handleAction('patch', '/drive/move', {type:'folder', itemId:f._id, targetId:t})}}><Move size={14}/> Move</div>
                                        <div onClick={()=>{setItemToShare(f); setShowShareModal(true)}}><Share2 size={14}/> Share</div>
                                        <div onClick={()=>handleAction('patch', `/drive/star/folder/${f._id}`, {isStarred:!f.isStarred})}><Star size={14}/> {f.isStarred?'Unstar':'Star'}</div>
                                        <div onClick={()=>handleAction('delete', `/drive/delete/folder/${f._id}`)} style={{color:'red'}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filesList.map(f => (
                            <div key={f._id} style={{padding:20, background:theme.card, borderRadius:12, border:`1px solid ${theme.border}`, textAlign:'center', position:'relative'}}>
                                <FileText size={40} color={theme.accent} style={{margin:'0 auto'}}/>
                                <p style={{marginTop:10, fontSize:13}}>{f.fileName}</p>
                                {uploadProgress[f.fileName] < 100 && <div style={{height:3, background:theme.border, marginTop:5, borderRadius:5, overflow:'hidden'}}><div style={{width:`${uploadProgress[f.fileName]}%`, background:theme.accent, height:'100%'}}></div></div>}
                                <MoreVertical style={{position:'absolute', top:10, right:10, cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`fi-${f._id}`)}}/>
                                {activeMenu === `fi-${f._id}` && (
                                    <div style={{position:'absolute', top:35, right:10, background:theme.card, border:`1px solid ${theme.border}`, zIndex:10, borderRadius:8, width:150, padding:8, display:'flex', flexDirection:'column', gap:8}}>
                                        <div onClick={async ()=>{const r=await axios.get(`${API}/drive/preview/${f._id}`, authConfig()); setPreviewFile(r.data.url)}}><Eye size={14}/> Preview</div>
                                        <div onClick={async ()=>{const r=await axios.get(`${API}/drive/preview/${f._id}?download=true`, authConfig()); window.open(r.data.url, '_blank')}}><Download size={14}/> Download</div>
                                        <div onClick={()=>{const t=prompt("Move to? root, vault, starred, or FolderID"); t && handleAction('patch', '/drive/move', {type:'file', itemId:f._id, targetId:t})}}><Move size={14}/> Move</div>
                                        <div onClick={()=>{setItemToShare(f); setShowShareModal(true)}}><Share2 size={14}/> Share</div>
                                        <div onClick={()=>handleAction('patch', `/drive/star/file/${f._id}`, {isStarred:!f.isStarred})}><Star size={14}/> {f.isStarred?'Unstar':'Star'}</div>
                                        <div onClick={()=>handleAction('delete', `/drive/delete/file/${f._id}`)} style={{color:'red'}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* PREVIEW */}
            {previewFile && <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setPreviewFile(null)}>
                <div style={{width:'85%', height:'85%', background:'#fff', borderRadius:12, overflow:'hidden'}} onClick={e=>e.stopPropagation()}><embed src={previewFile} width="100%" height="100%"/></div>
            </div>}

            {/* MANAGE ACCESS */}
            {showShareModal && <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setShowShareModal(false)}>
                <div style={{background:theme.card, padding:30, borderRadius:20, width:400}} onClick={e=>e.stopPropagation()}>
                    <h2 style={{marginBottom:20, display:'flex', alignItems:'center', gap:10}}><Share2/> Manage Access</h2>
                    <p style={{fontSize:12, marginBottom:10, opacity:0.7}}>Sharing: {itemToShare?.fileName || itemToShare?.name}</p>
                    <input placeholder="Enter recipient email" style={{width:'100%', padding:12, borderRadius:10, border:`1px solid ${theme.border}`, background:theme.bg, color:theme.text, marginBottom:15}} onChange={e=>setShareForm({...shareForm, email:e.target.value})}/>
                    <div style={{display:'flex', gap:10, marginBottom:15}}>
                        <select style={{flex:1, padding:12, borderRadius:10, border:`1px solid ${theme.border}`, background:theme.bg, color:theme.text}} onChange={e=>setShareForm({...shareForm, role:e.target.value})}>
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>
                        <select style={{flex:1, padding:12, borderRadius:10, border:`1px solid ${theme.border}`, background:theme.bg, color:theme.text}} onChange={e=>setShareForm({...shareForm, hours: parseInt(e.target.value)})}>
                            <option value="0">Unlimited</option>
                            <option value="1">1 Hour</option>
                            <option value="24">24 Hours</option>
                            <option value="168">1 Week</option>
                        </select>
                    </div>
                    <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
                        <button onClick={()=>setShowShareModal(false)} style={{padding:'10px 20px', background:'none', border:'none', color:theme.text, cursor:'pointer'}}>Cancel</button>
                        <button onClick={async ()=>{await axios.post(`${API}/files/share`, {fileId:itemToShare._id, type: itemToShare.fileName ? 'file':'folder', ...shareForm}, authConfig()); setShowShareModal(false); alert("Shared!");}} style={{padding:'10px 20px', background:theme.accent, color:'#fff', border:'none', borderRadius:10, cursor:'pointer'}}>Give Access</button>
                    </div>
                </div>
            </div>}
        </div>
    );
};

export default Drive;