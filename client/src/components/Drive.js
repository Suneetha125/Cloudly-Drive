// Drive.js (UPDATED with Dark/Light Mode, Shared Sidebar, Manage Access, robust file upload, fixed navigation, search, starring, and vault toggle)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderPlus, Upload, Trash2, FileText, Search, LogOut, Folder, X, ChevronRight, Sun, Moon, 
  MoreVertical, Share2, HardDrive, Users, Star, Shield, LayoutGrid, Eye, Fingerprint, Move, UserX,
  Link, Download 
} from 'lucide-react';

const API = "https://cloudly-dj52.onrender.com/api"; // Ensure this is your correct backend URL
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (Adjust as per your backend's chunk size expectation)

const Drive = () => {
    const [filesList, setFilesList] = useState([]);
    const [foldersList, setFoldersList] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null); // null for root folder
    const [activeTab, setActiveTab] = useState('files'); // 'files', 'starred', 'vault', 'shared'
    const [pathHistory, setPathHistory] = useState([]); // To manage navigation history for breadcrumbs and back
    const [previewFile, setPreviewFile] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null); // For context menu on files/folders
    const [profileOpen, setProfileOpen] = useState(false);
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [storage, setStorage] = useState({ used: 0, limit: 1 });
    const [showShareModal, setShowShareModal] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareForm, setShareForm] = useState({ email: '', role: 'viewer', hours: 0 });
    const [uploadProgress, setUploadProgress] = useState({}); // To track progress of multiple files
    const [searchTerm, setSearchTerm] = useState(''); // For search functionality
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false); // New state for vault status

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
            const fId = currentFolder ? currentFolder._id : "null"; // Use "null" string for root folder ID
            const res = await axios.get(`${API}/drive/contents`, {
                headers: authConfig().headers,
                params: { 
                    folderId: fId, 
                    tab: activeTab,
                    search: searchTerm, // Pass search term to backend
                    vaultUnlocked: isVaultUnlocked // Pass vault unlocked status
                }
            });
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
    }, [currentFolder, activeTab, authConfig, navigate, searchTerm, isVaultUnlocked]); // Add searchTerm and isVaultUnlocked to dependencies

    useEffect(() => { 
        fetchData(); 
        // Close menus when folder changes or data refreshes
        setActiveMenu(null); 
        setProfileOpen(false);
    }, [fetchData, currentFolder, activeTab]); // Include activeTab in dependency array for immediate refresh on tab change


    // --- FILE UPLOAD LOGIC ---
    const handleUpload = async (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length === 0) return;

        for (const file of selectedFiles) {
            try {
                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

                // 1. Initialize upload
                const initResponse = await axios.post(`${API}/upload/initialize`, {
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type 
                }, authConfig());
                const { uploadId } = initResponse.data;
                console.log(`Upload for ${file.name} initialized with ID:`, uploadId);

                // 2. Upload file in chunks
                let uploadedBytes = 0;
                let partNumber = 1;

                while (uploadedBytes < file.size) {
                    const chunk = file.slice(uploadedBytes, uploadedBytes + CHUNK_SIZE);
                    const formData = new FormData();
                    formData.append('chunk', chunk);
                    formData.append('uploadId', uploadId);
                    formData.append('partNumber', partNumber); 
                    formData.append('fileName', file.name); 

                    await axios.post(`${API}/upload/chunk`, formData, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem("token")}`,
                            'Content-Type': 'multipart/form-data' 
                        },
                        onUploadProgress: (progressEvent) => {
                            const percent = Math.round((uploadedBytes + progressEvent.loaded) * 100 / file.size);
                            setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
                        }
                    });

                    uploadedBytes += chunk.size;
                    partNumber++;
                }
                console.log(`All chunks for ${file.name} uploaded successfully.`);

                // 3. Complete upload
                const completeResponse = await axios.post(`${API}/upload/complete`, {
                    fileName: file.name,
                    uploadId: uploadId,
                    folderId: currentFolder ? currentFolder._id : null, 
                    isVault: activeTab === 'vault', 
                    mimeType: file.type, 
                    fileSize: file.size 
                }, authConfig());

                console.log(`File "${file.name}" uploaded successfully!`, completeResponse.data);
                alert(`File "${file.name}" uploaded successfully!`);
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 })); 
            } catch (err) {
                console.error(`Error uploading file "${file.name}":`, err.response ? err.response.data : err.message);
                alert(`Failed to upload file "${file.name}": ${err.response?.data?.error || err.message}`);
                setUploadProgress(prev => ({ ...prev, [file.name]: -1 })); 
            }
        }
        fetchData(); 
        event.target.value = null; 
    };
    // --- END FILE UPLOAD LOGIC ---

    // --- NAVIGATION HANDLERS ---
    const openFolder = (folder) => {
        // If currentFolder is not null, add it to history
        if (currentFolder) {
            setPathHistory(prev => [...prev, currentFolder]);
        } else {
            // If currentFolder is null (root), and we're navigating into a folder,
            // ensure history correctly starts with 'null' if we ever need to go back from the first subfolder.
            // Or, more simply, clear history if starting from root, and rely on `currentFolder` to indicate depth.
            // For smoother breadcrumbs, let's keep it simple: push currentFolder, even if it's null, or better,
            // only push valid folder objects.
            // Let's refine pathHistory to only store previous *folder objects*
            if(currentFolder) { // Only push actual folders to history
                setPathHistory(prev => [...prev, currentFolder]);
            }
        }
        setCurrentFolder(folder);
        setSearchTerm(''); // Clear search when navigating
    };

    const goBack = () => {
        if (pathHistory.length > 0) {
            const prevFolder = pathHistory.pop(); // Get last folder object from history
            setCurrentFolder(prevFolder); // Set currentFolder to the previous folder object (can be null for root)
            setPathHistory([...pathHistory]); // Update state to trigger re-render
        } else {
            setCurrentFolder(null); // Go to root if no history
            setPathHistory([]);
        }
        setSearchTerm(''); // Clear search when navigating
    };

    const jumpToFolderInBreadcrumb = (folderToJumpTo) => {
        // If jumping to null (My Drive)
        if (folderToJumpTo === null) {
            setCurrentFolder(null);
            setPathHistory([]);
        } else {
            // Find the index of the folderToJumpTo in pathHistory
            const index = pathHistory.findIndex(f => f._id === folderToJumpTo._id);
            if (index !== -1) {
                // If the folder is in history, slice the history up to that point
                const newPathHistory = pathHistory.slice(0, index);
                setCurrentFolder(pathHistory[index]); // Set the folder object
                setPathHistory(newPathHistory);
            } else if (currentFolder && currentFolder._id === folderToJumpTo._id) {
                // Clicking the current folder in breadcrumb, do nothing or refresh
                console.log("Already in this folder.");
            } else {
                // This case should ideally not happen if pathHistory is managed correctly
                // It means trying to jump to a folder not in the direct ancestor path
                setCurrentFolder(folderToJumpTo);
                setPathHistory([]); // Reset history if jumping to an unrelated folder
            }
        }
        setSearchTerm(''); // Clear search when navigating
        setActiveMenu(null); 
    };
    // --- END NAVIGATION HANDLERS ---

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
            // Reusing the preview endpoint, as your backend doesn't have a distinct /files/download
            // The preview endpoint returns a signed URL which, when opened, often triggers download.
            const res = await axios.get(`${API}/drive/preview/${file._id}`, authConfig());
            const downloadUrl = res.data.url;
            window.open(downloadUrl, '_blank'); 
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
            // Updated to match your backend's /api/drive/delete/:type/:id endpoint
            await axios.delete(`${API}/drive/delete/${type}/${id}`, authConfig());
            alert(`${type} deleted successfully.`);
            fetchData();
        } catch (err) {
            console.error("Delete error:", err.response?.data || err);
            alert(`Failed to delete ${type}: ${err.response?.data?.error || "Unknown error."}`);
        }
    };

    const handleStarToggle = async (type, item) => {
        try {
            // Your backend has PATCH /api/drive/star/:type/:id
            await axios.patch(`${API}/drive/star/${type}/${item._id}`, { isStarred: !item.isStarred }, authConfig());
            alert(`${item.name || item.fileName} ${!item.isStarred ? 'starred' : 'unstarred'} successfully.`);
            fetchData();
        } catch (err) {
            console.error("Star toggle error:", err.response?.data || err);
            alert(`Failed to update star status: ${err.response?.data?.error || "Unknown error."}`);
        } finally {
            setActiveMenu(null);
        }
    };

    // **IMPORTANT**: Your backend's /api/drive/move only changes parentFolder, not isVault.
    // To move items to/from vault, you'd ideally need dedicated backend endpoints
    // like PATCH /api/files/vault/:id and PATCH /api/folders/vault/:id that update the 'isVault' field.
    // For now, I'll add a placeholder action that will *not* work without backend changes.
    const handleToggleVaultStatus = async (type, item) => {
        // This function requires backend support to toggle `isVault` status.
        // Your current backend's /api/drive/move only updates `parentFolder`.
        // You would need an endpoint like PATCH /api/drive/toggle-vault/:type/:id
        alert("Moving items to/from Vault is not yet supported by the backend 'move' endpoint. Please implement a dedicated backend route to change 'isVault' status.");
        // Example of what the call *would* look like if you had a backend endpoint for this:
        /*
        try {
            await axios.patch(`${API}/drive/toggle-vault/${type}/${item._id}`, { isVault: !item.isVault }, authConfig());
            alert(`${item.name || item.fileName} ${!item.isVault ? 'moved to' : 'removed from'} Vault.`);
            fetchData();
        } catch (err) {
            console.error("Vault toggle error:", err.response?.data || err);
            alert(`Failed to update vault status: ${err.response?.data?.error || "Unknown error."}`);
        } finally {
            setActiveMenu(null);
        }
        */
       setActiveMenu(null); // Close menu regardless
    };


    const theme = { 
        bg: isDark ? '#0f172a' : '#f8fafc', 
        card: isDark ? '#1e293b' : '#ffffff', 
        text: isDark ? '#f1f5f9' : '#1e293b', 
        border: isDark ? '#334155' : '#e2e8f0', 
        accent: '#3b82f6',
        accentLight: isDark ? '#60a5fa' : '#bfdbfe'
    };

    const dynamicStyles = {
        nav: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', color: theme.text },
        navAct: { display:'flex', gap:15, padding:'12px 20px', borderRadius:10, cursor:'pointer', background: theme.accentLight, color: theme.accent, fontWeight:'bold' },
        userCircle: { width:32, height:32, borderRadius:'50%', background:theme.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', cursor:'pointer' },
        btnBlue: { background:theme.accent, color:'#fff', padding:'12px 24px', borderRadius:'24px', cursor:'pointer', display:'flex', gap:10, fontWeight:'500', border:'none', alignItems:'center', justifyContent:'center' },
        grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:25, marginTop:30 },
        card: { padding:25, borderRadius:16, border:`1px solid ${theme.border}`, textAlign:'center', position:'relative', cursor:'pointer', background: theme.card, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between' },
        dots: { position:'absolute', top:15, right:15, color:theme.text, cursor:'pointer' },
        drop: { position:'absolute', top:40, right:15, borderRadius:8, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:10, width:160, display:'flex', flexDirection:'column', gap:10, fontSize:13, textAlign:'left', background:theme.card, border:`1px solid ${theme.border}`, color:theme.text },
        overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
        profileDrop: { position:'absolute', top:45, right:0, width:220, borderRadius:20, boxShadow:'0 4px 15px rgba(0,0,0,0.1)', zIndex:3000, padding:20, background:theme.card, border:`1px solid ${theme.border}`, color:theme.text },
        logoutBtn: { background:'none', border:`1px solid ${theme.border}`, padding:'10px 20px', borderRadius:10, cursor:'pointer', width:'100%', marginTop:10, display:'flex', alignItems:'center', gap:8, fontSize:12, color:theme.text },
        bar: { height:6, background:theme.border, borderRadius:10, marginTop:10, overflow:'hidden' },
        searchBar: { background: theme.card, width: '500px', padding: '12px 20px', borderRadius: '12px', display:'flex', alignItems:'center', border:`1px solid ${theme.border}` },
        breadcrumb: { display:'flex', alignItems:'center', gap:10, fontSize:18, marginBottom:30, color:theme.text },
        iconBtn: { background:'none', border:'none', cursor:'pointer', color:'inherit', padding:8 },
        modalContent: { background: theme.card, padding: 30, borderRadius: 15, boxShadow: '0 5px 20px rgba(0,0,0,0.2)', width: 400, display:'flex', flexDirection:'column', gap:20, color:theme.text },
        storageBox: { 
            padding: '20px 0',
            borderTop: `1px solid ${theme.border}`,
            marginTop: 'auto', 
            color: theme.text
        },
        progressBarContainer: {
            width: '100%',
            height: '4px',
            background: theme.border,
            borderRadius: '2px',
            marginTop: '5px',
            overflow: 'hidden'
        },
        progressBar: {
            height: '100%',
            background: theme.accent,
            width: '0%', 
            transition: 'width 0.1s ease-in-out'
        },
        progressText: {
            fontSize: '10px',
            color: theme.text,
            marginTop: '5px'
        }
    };

    // Filtered lists for display based on search term (now applied to the fetched data)
    // The actual filtering should ideally happen on the backend when searchTerm is sent.
    // If backend doesn't filter, this is a client-side filter.
    const displayFolders = foldersList.filter(folder => 
        folder.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const displayFiles = filesList.filter(file => 
        file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, display: 'flex' }} onClick={() => {setActiveMenu(null); setProfileOpen(false)}}>
            {/* Sidebar */}
            <aside style={{ width: 280, borderRight: `1px solid ${theme.border}`, padding: '30px 15px', display: 'flex', flexDirection: 'column', gap: 5, background: theme.card }}>
                <h1 style={{fontSize:20, fontWeight:'bold', marginBottom:30}}>Cloudly</h1>
                <div style={activeTab === 'files' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => {setActiveTab('files'); setCurrentFolder(null); setPathHistory([]); setIsVaultUnlocked(false);}}><LayoutGrid size={20}/> My Drive</div>
                <div style={activeTab === 'shared' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => {setActiveTab('shared'); setCurrentFolder(null); setPathHistory([]); setIsVaultUnlocked(false);}}><Users size={20}/> Shared with me</div>
                <div style={activeTab === 'starred' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={() => {setActiveTab('starred'); setIsVaultUnlocked(false);}}><Star size={20}/> Starred</div>
                <div style={activeTab === 'vault' ? dynamicStyles.navAct : dynamicStyles.nav} onClick={async (e)=>{ 
                    e.stopPropagation(); // Prevent immediate menu close
                    const p = prompt("Enter Vault PIN:"); 
                    if (p) {
                        try {
                            await axios.post(`${API}/vault/unlock`, {pin:p}, authConfig());
                            setActiveTab('vault');
                            setCurrentFolder(null); 
                            setPathHistory([]);
                            setIsVaultUnlocked(true); // Vault is now unlocked
                            alert("Vault unlocked!");
                        } catch (err) {
                            alert(err.response?.data?.error || "Failed to unlock vault.");
                            setIsVaultUnlocked(false);
                        }
                    } else {
                        // User cancelled PIN entry
                        setIsVaultUnlocked(false);
                    }
                }}><Shield size={20} color="#ef4444"/> Vault</div>
                <div style={dynamicStyles.storageBox}> 
                    <p style={{fontSize:11, marginTop:20}}>Storage: {(storage.used/1024/1024/1024).toFixed(2)}GB / {(storage.limit/1024/1024/1024).toFixed(2)}GB</p>
                    <div style={dynamicStyles.bar}><div style={{width:`${(storage.used/storage.limit)*100}%`, height:'100%', background:theme.accent}}></div></div>
                </div>
            </aside>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: 80, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={dynamicStyles.searchBar}>
                        <Search size={18} color="#94a3b8"/>
                        <input 
                            placeholder="Search files and folders..." 
                            style={{border:'none', background:'transparent', marginLeft:15, width:'100%', outline:'none', color:theme.text}} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
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
                        <span onClick={() => jumpToFolderInBreadcrumb(null)} style={{cursor:'pointer'}}>My Drive</span>
                        {pathHistory.map((folder, i) => (
                            <span key={folder._id}> 
                                <ChevronRight size={16} style={{display:'inline'}}/> 
                                <span onClick={()=>{jumpToFolderInBreadcrumb(folder)}} style={{cursor:'pointer'}}>{folder.name}</span>
                            </span>
                        ))}
                         {currentFolder && (
                            <span> 
                                <ChevronRight size={16} style={{display:'inline'}}/> 
                                <span>{currentFolder.name}</span>
                            </span>
                        )}
                        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
                            {currentFolder && <button onClick={goBack} style={{...dynamicStyles.btnBlue, background: theme.card, color: theme.text, border:`1px solid ${theme.border}`}}>Back</button>}
                            {activeTab !== 'shared' && activeTab !== 'starred' && activeTab !== 'trash' && (
                                <>
                                    <label style={dynamicStyles.btnBlue}><Upload size={18}/> Upload<input type="file" hidden multiple onChange={handleUpload}/></label>
                                    <button style={{...dynamicStyles.btnBlue, background: theme.card, color: theme.accent, border:`1px solid ${theme.accent}`}} onClick={() => {const n=prompt("Name for new folder:"); n && axios.post(`${API}/folders`,{name:n, parentFolder:currentFolder?._id, isVault: activeTab==='vault'}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to create folder."))}}><FolderPlus size={18}/></button>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={dynamicStyles.grid}>
                        {displayFolders.map(f => (
                            <div key={`folder-${f._id}`} style={{...dynamicStyles.card}} onDoubleClick={()=>{openFolder(f)}}>
                                <Folder size={48} color="#fbbf24" fill="#fbbf24" style={{opacity:0.7}}/>
                                <p style={{marginTop:15, fontWeight:'bold', color:theme.text}}>{f.name}</p>
                                {activeTab !== 'shared' && activeTab !== 'starred' && activeTab !== 'trash' && (
                                    <MoreVertical style={dynamicStyles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`folder-${f._id}`)}}/>
                                )}
                                {activeMenu === `folder-${f._id}` && (
                                    <div style={{...dynamicStyles.drop}}>
                                        <div onClick={(e)=>{e.stopPropagation(); openFolder(f)}}><Eye size={14}/> Open</div> 
                                        {activeTab !== 'vault' && ( // Cannot star/vault folders directly from vault tab
                                            <div onClick={(e)=>{e.stopPropagation(); handleStarToggle('folder', f)}}><Star size={14}/> {f.isStarred ? 'Unstar' : 'Star'}</div>
                                        )}
                                        {activeTab !== 'vault' && ( // Only move to vault from non-vault tabs
                                            <div onClick={(e)=>{e.stopPropagation(); handleToggleVaultStatus('folder', f)}}><Shield size={14}/> Move to Vault</div>
                                        )}
                                        <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Enter target folder ID to move to (or 'root' for main drive):"); if(tid) axios.patch(`${API}/drive/move`, {type:'folder', itemId:f._id, targetId:tid==='root'?null:tid}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to move folder."))}}><Move size={14}/> Move</div>
                                        <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); handleDelete('folder', f._id)}}><Trash2 size={14}/> Delete</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {displayFiles.map(f => (
                            <div key={`file-${f._id}`} style={{...dynamicStyles.card}}>
                                <FileText size={48} color={theme.accent}/>
                                <p style={{marginTop:15, fontSize:13, color:theme.text}}>{f.fileName}</p>
                                {uploadProgress[f.fileName] !== undefined && uploadProgress[f.fileName] < 100 && (
                                    <div style={dynamicStyles.progressBarContainer}>
                                        <div style={{...dynamicStyles.progressBar, width: `${uploadProgress[f.fileName]}%`}}></div>
                                        <p style={dynamicStyles.progressText}>Uploading: {uploadProgress[f.fileName]}%</p>
                                    </div>
                                )}
                                {uploadProgress[f.fileName] === -1 && (
                                    <p style={{...dynamicStyles.progressText, color:'red'}}>Upload Failed</p>
                                )}
                                <MoreVertical style={dynamicStyles.dots} onClick={(e)=>{e.stopPropagation(); setActiveMenu(`file-${f._id}`)}}/>
                                {activeMenu === `file-${f._id}` && (
                                    <div style={{...dynamicStyles.drop}}>
                                        <div onClick={(e)=>{e.stopPropagation(); axios.get(`${API}/drive/preview/${f._id}`, authConfig()).then(res => setPreviewFile(res.data.url)).catch(err => alert(err.response?.data?.error || "Failed to preview file."))}}><Eye size={14}/> Preview</div>
                                        <div onClick={(e)=>{e.stopPropagation(); handleDownload(f)}}><Download size={14}/> Download</div>
                                        {activeTab !== 'vault' && (
                                            <div onClick={(e)=>{e.stopPropagation(); handleStarToggle('file', f)}}><Star size={14}/> {f.isStarred ? 'Unstar' : 'Star'}</div>
                                        )}
                                        {f.owner === localStorage.getItem("userId") && ( // Only owner can move/share/delete
                                            <>
                                                {activeTab !== 'vault' && ( // Only move to vault from non-vault tabs
                                                    <div onClick={(e)=>{e.stopPropagation(); handleToggleVaultStatus('file', f)}}><Shield size={14}/> Move to Vault</div>
                                                )}
                                                <div onClick={(e)=>{e.stopPropagation(); openShareModal(f)}}><Share2 size={14}/> Share</div>
                                                <div onClick={(e)=>{e.stopPropagation(); const tid=prompt("Enter target folder ID to move to (or 'root' for main drive):"); if(tid) axios.patch(`${API}/drive/move`, {type:'file', itemId:f._id, targetId:tid==='root'?null:tid}, authConfig()).then(fetchData).catch(err => alert(err.response?.data?.error || "Failed to move file."))}}><Move size={14}/> Move</div>
                                                <div style={{color:'red'}} onClick={(e)=>{e.stopPropagation(); handleDelete('file', f._id)}}><Trash2 size={14}/> Delete</div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {displayFiles.length === 0 && displayFolders.length === 0 && (
                        <p style={{textAlign:'center', marginTop:50, color:theme.text}}>No items found in this {activeTab === 'files' ? 'folder' : activeTab} or matching your search.</p>
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