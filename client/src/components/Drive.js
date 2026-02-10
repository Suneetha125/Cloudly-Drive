// Drive.js (UPDATED with Dark/Light Mode, Shared Sidebar, Manage Access)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move, UserX,
  Link, Download // Added Link for shareable link, Download for direct download
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api";
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [activeTab, setActiveTab] = useState('files'); // 'files', 'starred', 'vault', 'shared'
    const [path, setPath] = useState([]); // Breadcrumb path
    const [previewFile, setPreviewFile] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null); // For context menu on files/folders
    const [profileOpen, setProfileOpen] = useState(false);
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [showShareModal, setShowShareModal] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareForm, setShareForm] = useState({ email: '', role: 'viewer', hours: 0 });

    const navigate = useNavigate();
    const authConfig = useCallback(() => ({ 
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } 
    }), []);
    const userName = localStorage.getItem("userName") || "User";

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const fetchData = useCallback(async () => {
        try {
            const fId = currentFolder ? currentFolder._id : "null";
            const res = await axios.get(`${API}/drive/contents?folderId=${fId}&tab=${activeTab}`, authConfig());
            setFilesList(res.data.files || []); 
            setFoldersList(res.data.folders || []);
            
            const sRes = await axios.get(`${API}/drive/storage`, authConfig());
            setStorage(sRes.data);
        } catch (err) { 
            console.error("Fetch data error:", err);
            if (err.response?.status === 401) {
                localStorage.clear();
                navigate('/'); // Redirect to login if token is invalid/expired
            }
            alert(err.response?.data?.error || "Failed to load drive contents.");
        }
    }, [currentFolder, activeTab, authConfig, navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

   // ... in your frontend upload handler (e.g., in Drive.js onChange)

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // 1. Initialize upload (get uploadId)
        const initResponse = await fetch('YOUR_BACKEND_URL/api/upload/initialize', { /* ... auth headers ... */ });
        const { uploadId } = await initResponse.json();

        // (Assuming you have chunking logic here, and it successfully saves to /tmp)

        // 2. Complete upload
        const completeResponse = await fetch('YOUR_BACKEND_URL/api/upload/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${yourAuthToken}`,
            },
            body: JSON.stringify({
                fileName: file.name,
                uploadId: uploadId, // Make sure this matches the one you got from initialize
                folderId: yourCurrentFolderId, // Or null for root
                isVault: false, // Or true if applicable
                mimeType: file.type // <--- THIS IS THE MISSING PIECE!
            }),
        });

        if (!completeResponse.ok) {
            const errorData = await completeResponse.json();
            throw new Error(errorData.error || 'Unknown upload completion error');
        }

        const uploadedFile = await completeResponse.json();
        console.log('File uploaded successfully:', uploadedFile);
        // ... update UI ...

    } catch (error) {
        console.error('Error uploading file:', file.name, error);
        alert(`Failed to upload file "${file.name}": ${error.message || error}`);
    }
};
    const jumpToFolder = (index) => {
        if (index === -1) { 
            setCurrentFolder(null); 
            setPath([]); 
        } else { 
            const newPath = path.slice(0, index + 1); 
            setCurrentFolder(newPath[index]); 
            setPath(newPath); 
        }
        setActiveMenu(null); // Close any open context menu
    };

    const toggleTheme = () => setIsDark(!isDark);

    const openShareModal = (file) => {
        setItemToShare(file);
        setShareForm({ email: '', role: 'viewer', hours: 0 }); // Reset form
        setShowShareModal(true);
        setActiveMenu(null); // Close context menu
    };

    const handleShare = async () => {
        try {
            await axios.post(`${API}/files/share`, { 
                fileId: itemToShare._id, 
                email: shareForm.email, 
                role: shareForm.role, 
                hours: shareForm.hours 
            }, authConfig());
            alert(`File "${itemToShare.fileName}" shared successfully with ${shareForm.email}!`);
            setShowShareModal(false);
            fetchData();
        } catch (err) {
            console.error("Share error:", err.response?.data || err);
            alert(`Failed to share file: ${err.response?.data?.error || "Unknown error."}`);
        }
    };

    const handleDownload = async (file) => {
        try {
            const res = await axios.get(`${API}/files/preview/${file._id}`, authConfig());
            const downloadUrl = res.data.url;
            window.open(downloadUrl, '_blank'); // Open in new tab to trigger download
        } catch (err) {
            console.error("Download error:", err.response?.data || err);
            alert(`Failed to download file: ${err.response?.data?.error || "Unknown error."}`);
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
            return;
        }
        try {
            if (type === 'file') {
                await axios.delete(`${API}/files/${id}`, authConfig());
                alert("File deleted successfully.");
            } else if (type === 'folder') {
                await axios.delete(`${API}/folders/${id}`, authConfig());
                alert("Folder and its contents deleted successfully.");
            }
            fetchData();
        } catch (err) {
            console.error("Delete error:", err.response?.data || err);
            alert(`Failed to delete ${type}: ${err.response?.data?.error || "Unknown error."}`);
        }
    };

    const theme = { 
        bg: isDark ? '#0f172a' : '#f8fafc', 
        card: isDark ? '#1e293b' : '#ffffff', 
        text: isDark ? '#f1f5f9' : '#1e293b', 
        border: isDark ? '#334155' : '#e2e8f0', 
        accent: '#3b82f6',
        accentLight: isDark ? '#60a5fa' : '#bfdbfe'
    };

    // Updated styles to reflect theme changes and new UI elements
    const dynamicStyles = {
        nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: theme.text },
        navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background: theme.accentLight, color: theme.accent, fontWeight:'bold' },
        userCircle: { width:32, height:32, borderRadius:'50%', background:theme.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', cursor:'pointer' },
        btnBlue: { background:theme.accent, color:'#fff', padding:'12px 24px', borderRadius:'24px', cursor:'pointer', display:'flex', gap:10, fontWeight:'500', border:'none' },
        grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25, marginTop:30 },
        card: { padding:25, borderRadius:16, border:`1px solid ${theme.border}`, textAlign:'center', position:'relative', cursor:'pointer', background: theme.card },
        dots: { position:'absolute', top:15, right:15, color:theme.text, cursor:'pointer' },
        drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:10, width:160, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left', background:theme.card, border:`1px solid ${theme.border}`, color:theme.text },
        overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
        profileDrop: { position:'absolute', top:45, right:0, width:220, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:20, background:theme.card, border:`1px solid ${theme.border}`, color:theme.text },
        logoutBtn: { background:'none', border:`1px solid ${theme.border}`, padding:'10px 20px', borderRadius:10, cursor:'pointer', width:'100%', marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:12, color:theme.text },
        bar: { height:6, background:theme.border, borderRadius:10, marginTop:10, overflow:'hidden' },
        searchBar: { background: theme.card, width: '500px', padding: '12px 20px', borderRadius: '12px', display:'flex', alignItems:'center', border:`1px solid ${theme.border}` },
        breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18, marginBottom:30, color:theme.text },
        iconBtn: { background:'none', border:'none', cursor:'pointer', color:'inherit', padding:8 },
        modalContent: { background: theme.card, padding: 30, borderRadius: 15, boxShadow: '0 5px 20px rgba(0,0,0,0.2)', width: 400, display:'flex', flexDirection:'column', gap:20, color:theme.text }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
            {/* Sidebar */}
            <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: '30px 15px', display: 'flex', flexDirection: 'column', gap: 5, background: theme.card }}>
                <h1 style={{fontSize:20, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab === 'files' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => {setActiveTab('files'); setCurrentFolder(null); setPath([]);}}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab === 'shared' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => {setActiveTab('shared'); setCurrentFolder(null); setPath([]);}}><Users size={20}/> Shared with me</div>
                <div style={activeTab === 'starred' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => setActiveTab('starred')}><Star size={20}/> Starred</div>
                <div style={activeTab === 'vault' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={async ()=>{ 
                    const p = prompt("Enter Vault PIN:"); 
                    if (p) {
                        try {
                            await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig());
                            setActiveTab('vault');
                            setCurrentFolder(null); // Reset path for vault
                            setPath([]);
                            alert("Vault unlocked!");
                        } catch (err) {
                            alert(err.response?.data?.error || "Failed to unlock vault.");
                        }
                    }
                }}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={dynamicStyles.storageBox}> {/* Consider moving storageBox style inline or to dynamicStyles */}
                    <p style={{fontSize:11, marginTop:20}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / {(storage.limit/1024/1024/1024).toFixed(2)}GB</p>
                    <div style={dynamicStyles.bar}><div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: 80, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={dynamicStyles.searchBar}><Search size={18} color="#94a3b8"/><input placeholder="Search files..." style={{border:'none', background:'transparent', marginLeft:15, width:'100%', outline:'none', color:theme.text}} /></div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', position:'relative' }}>
                        <button onClick={toggleTheme} style={dynamicStyles.iconBtn}>
                            {isDark ? <Sun size={20} color={theme.text}/> : <Moon size={20} color={theme.text}/>}
                        </button>
                        <div style={dynamicStyles.userCircle} onClick={(e)=>{e.stopPropagation(); setProfileOpen(!profileOpen)}}>{userName[0]}</div>
                        {profileOpen && (
                            <div style={{...dynamicStyles.profileDrop}}>
                                <p style={{fontWeight:'bold'}}>Hi, {userName}!</p>
                                <button onClick={async (e)=>{ e.stopPropagation(); if(window.confirm("Are you sure you want to delete your account? This action is irreversible.")) { await axios.delete(`${API}/auth/delete-account`, authConfig()); localStorage.clear(); navigate('/'); } }} style={{...dynamicStyles.logoutBtn, color:'red', borderColor:'red'}}><UserX size={16}/> Delete Account</button>
                                <button onClick={(e)=>{e.stopPropagation(); localStorage.clear(); navigate('/')}} style={dynamicStyles.logoutBtn}><LogOut size={16}/> Sign out</button>
                            </div>
                        )}
                    </div>
                </header>

                <div style={{ padding: 40, flex: 1, overflowY: 'auto' }}>
                    <div style={dynamicStyles.breadcrumb}>
                        <span onClick={() => jumpToFolder(-1)} style={{cursor:'pointer'}}>My Drive</span>
                        {path.map((p, i) => <span key={p._id} onClick={()=>{jumpToFolder(i)}} style={{cursor:'pointer'}}> <ChevronRight size={16} style={{display:'inline'}}/> {p.name}</span>)}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            {activeTab !== 'shared' && activeTab !== 'starred' && activeTab !== 'trash' && (
                                <>
                                    <label style={dynamicStyles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                                    <button style={{...dynamicStyles.btnBlue, background: theme.card, color: theme.accent, border:`1px solid ${theme.accent}`}} onClick={() => {const n=prompt("Name for new folder:"); n && axios.post(`${API}/folders`,{name:n, parentFolder:currentFolder?._id, isVault: activeTab==='vault'}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to create folder."))}}><FolderPlus size={18}/></button>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={dynamicStyles.grid}>
                        {foldersList.map(f => (
                            <div key={`folder-${f._id}`} style={{...dynamicStyles.card}} onDoubleClick={()=>{setPath([...path, f]); setCurrentFolder(f)}}>
                                <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                                <p style={{marginTop:15, fontWeight:'bold', color:theme.text}}>{f.name}</p>
                                {activeTab !== 'shared' && activeTab !== 'starred' && activeTab !== 'trash' && (
                                    <MoreVertical style={dynamicStyles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`folder-${f._id}`)}}/>
                                )}
                                {activeMenu === `folder-${f._id}` && (
                                    <div style={{...dynamicStyles.drop}}>
                                        <div onClick={(e)=>{e.stopPropagation(); jumpToFolder(path.length) /* Effectively open current folder*/}}><Eye size={14}/> Open</div>
                                        <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Enter target folder ID to move to (or 'root' for main drive):"); if(tid) axios.patch(`${API}/drive/move`, {type:'folder', itemId:f._id, targetId:tid}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to move folder."))}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); handleDelete('folder', f._id)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filesList.map(f => (
                            <div key={`file-${f._id}`} style={{...dynamicStyles.card}}>
                                <FileText size={48} color={theme.accent}/>
                                <p style={{marginTop:15, fontSize:13, color:theme.text}}>{f.fileName}</p>
                                <MoreVertical style={dynamicStyles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`file-${f._id}`)}}/>
                                {activeMenu === `file-${f._id}` && (
                                    <div style={{...dynamicStyles.drop}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/files/preview/${f._id}`, authConfig()).then(res => setPreviewFile(res.data.url)).catch(err => alert(err.response?.data?.error || "Failed to preview file."))}}><Eye size={14}/> Preview</div>
                                        <div onClick={(e)=>{e.stopPropagation(); handleDownload(f)}}><Download size={14}/> Download</div>
                                        {f.owner === localStorage.getItem("userId") && ( // Only owner can move/share/delete
                                            <>
                                                <div onClick={(e)=>{e.stopPropagation(); openShareModal(f)}}><Share2 size={14}/> Share</div>
                                                <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Enter target folder ID to move to (or 'root' for main drive):"); if(tid) axios.patch(`${API}/drive/move`, {type:'file', itemId:f._id, targetId:tid}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to move file."))}}><Move size={14}/> Move</div>
                                                <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); handleDelete('file', f._id)}}><Trash2 size={14}/> Delete</div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {filesList.length === 0 && foldersList.length === 0 && (
                        <p style={{textAlign:'center', marginTop:50, color:theme.text}}>No items found in this {activeTab === 'files' ? 'folder' : activeTab}.</p>
                    )}
                </div>
            </main>
            {previewFile && <div style={dynamicStyles.overlay} onClick={()=>setPreviewFile(null)}><div style={{width:'80%', height:'80%', borderRadius:10, overflow:'hidden'}}><embed src={previewFile} width="100%" height="100%"/></div></div>}

            {/* Share Modal */}
            {showShareModal && (
                <div style={dynamicStyles.overlay} onClick={()=>setShowShareModal(false)}>
                    <div style={dynamicStyles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>Share "{itemToShare?.fileName}"</h3>
                        <div style={{display:'flex', flexDirection:'column', gap:10}}>
                            <input 
                                type="email" 
                                placeholder="Recipient Email" 
                                value={shareForm.email} 
                                onChange={(e) => setShareForm({...shareForm, email: e.target.value})} 
                                style={{...dynamicStyles.inputNo, padding:10, background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, color:theme.text}}
                                required
                            />
                            <select 
                                value={shareForm.role} 
                                onChange={(e) => setShareForm({...shareForm, role: e.target.value})}
                                style={{...dynamicStyles.inputNo, padding:10, background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, color:theme.text}}
                            >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                            </select>
                            <input 
                                type="number" 
                                placeholder="Expiry (hours, 0 for no expiry)" 
                                value={shareForm.hours} 
                                onChange={(e) => setShareForm({...shareForm, hours: parseInt(e.target.value) || 0})} 
                                style={{...dynamicStyles.inputNo, padding:10, background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:8, color:theme.text}}
                                min="0"
                            />
                        </div>
                        <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
                            <button onClick={()=>setShowShareModal(false)} style={{...dynamicStyles.logoutBtn, border:`1px solid ${theme.accent}`, color:theme.accent}}>Cancel</button>
                            <button onClick={handleShare} style={dynamicStyles.btnBlue}>Share</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Drive;