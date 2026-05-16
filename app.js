/**
 * AnimTube v1.1 - BULK & DELETE Support
 * Sequence: Text First -> Website Return -> Visual Copy -> ChatGPT Send
 */

// --- SUPABASE CONFIG (SYNC ENGINE v2.0) ---
const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

function getDB() {
    try {
        const lib = window.supabase;
        if (!lib) {
            console.error("❌ Supabase library not found in window.supabase");
            return null;
        }

        // Try standard createClient
        const client = lib.createClient ? lib.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
        
        if (client) {
            if (typeof client.from === 'function') {
                console.log("✅ Supabase Client initialized successfully.");
                // Connection test (silent)
                client.from('folders').select('id').limit(1).then(({error}) => {
                    if (error) {
                         console.error("🔏 Database connection test failed:", error.message);
                         logStatus("⚠️ База данных недоступна: " + error.message, "error");
                         if (error.message.includes("403") || error.message.includes("JWT")) {
                             logStatus("🔑 Ошибка авторизации. Проверьте настройки проекта Supabase.", "error");
                         }
                    } else {
                         console.log("📡 Cloud Database reachable.");
                         const cDot = document.getElementById('cloud-status-indicator');
                         if (cDot) cDot.style.background = '#10b981';
                    }
                });
                return client;
            } else {
                const keys = Object.keys(client).join(', ');
                console.error("⚠️ Client created but .from is missing. Available keys: " + keys);
                // Last ditch effort: maybe it's nested?
                if (client.supabase && typeof client.supabase.from === 'function') return client.supabase;
                throw new Error("Client structure invalid. Keys: " + (keys || "none"));
            }
        }
        console.error("❌ Failed to create Supabase client.");
        return null;
    } catch (e) {
        console.error("❌ getDB Error:", e);
        // Display error in UI if possible
        const errBox = document.getElementById('cloud-error-box');
        if (errBox) errBox.innerText = "Init Error: " + e.message;
        logStatus("❌ Ошибка инициализации БД: " + e.message, "error");
        return null;
    }
}

let cloudDB = null;
let activeAvatarTarget = null;

// --- SECURITY CONFIG & STATE ---
const WHITELIST = [
    { login: "Denis", pass: "Ub1dFnfCFUzVRDv", code: "529952203893", role: "owner", ip: "*" }, // Owner allows all IPs for testing
	{ login: "Alexander Evie", pass: "0gX1t39fZMA2HY7", code: "984377574594", role: "partner", ip: "185.113.136.128" }, // Example partner
	{ login: "Alexander George", pass: "k8ocT1wRnkhMQij", code: "681523913214", role: "partner", ip: "91.132.162.219" }, // Example partner
	{ login: "Alya", pass: "JAh92C36h3MkiMk", code: "805344411736", role: "partner", ip: "*" }, // Limited partner
    { login: "Alexey", pass: "JAh92C36h3MkiMk", code: "255681851403", role: "partner", ip: "127.0.0.1" }, // Example partner
    { login: "Andrey", pass: "sbduB1HtwgQeFav", code: "743088149512", role: "manager", ip: "130.49.89.192" } // Test Manager
];

const HARDCODED_LINKS = {
    "GEORGE’S WORLD": "https://drive.google.com/drive/folders/1lXxiMJy7oL-14NQzbQMM8gvymKDsLe-0?usp=drive_link",
    "EVIE'S WORLD": "https://drive.google.com/drive/folders/1xA4MwJhr3tpfQrHp_spgwCZ4aYagAvXg?usp=drive_link",
    "PEPPA DARK": "https://drive.google.com/drive/folders/1uKUrcQZOedqxww2hO3gzundsJWDG17vC?usp=drive_link",
    "Hiden Pig": "https://drive.google.com/drive/folders/1quim3FCwQ53KrS6vpYjqETc_332mZOUN?usp=drive_link",
    "Peppa Horror": "https://drive.google.com/drive/folders/1C3IRRD_WQdp92TkbesxfoIeudyLut8g5?usp=drive_link"
};

// --- REALTIME & NOTIFICATIONS CONFIG ---
const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"; // Subtle "blip"
let isTabActive = true;
document.addEventListener('visibilitychange', () => { isTabActive = !document.hidden; });

function playNotificationSound() {
    // Audio notifications removed as requested
}

function flashTitleNotification(message = "💰 ОБНОВЛЕНИЕ") {
    const originalTitle = document.title;
    if (!isTabActive) {
        let isFlash = false;
        const interval = setInterval(() => {
            document.title = isFlash ? message : originalTitle;
            isFlash = !isFlash;
            if (isTabActive) {
                clearInterval(interval);
                document.title = originalTitle;
            }
        }, 1000);
        // Auto-stop after 30s if still not active
        setTimeout(() => { clearInterval(interval); document.title = originalTitle; }, 30000);
    }
}

async function setupRealtimeSync() {
    if (!cloudDB) return;
    
    console.log("📡 Initializing Realtime Listeners...");
    
    // Listen for Channel changes (Income/Views/Assignments)
    cloudDB.channel('folders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, payload => {
        console.log("🔔 [REALTIME] Folders change:", payload.eventType, payload.new);
        if (payload.eventType === 'INSERT') {
            const exists = state.folders.find(f => String(f.id) === String(payload.new.id));
            if (!exists) {
                state.folders.unshift(payload.new);
                logStatus(`✨ Новый канал: ${payload.new.name}`, "info");
            }
        } else if (payload.eventType === 'UPDATE') {
            const updatedFolder = payload.new;
            const idx = state.folders.findIndex(f => String(f.id) === String(updatedFolder.id));
            if (idx !== -1) {
                const oldFolder = state.folders[idx];
                
                // Detection for alerts
                const assignmentChanged = updatedFolder.assignedTo !== oldFolder.assignedTo;
                const viewsChanged = Number(updatedFolder.views) !== Number(oldFolder.views);
                const revenueChanged = Number(updatedFolder.revenue) !== Number(oldFolder.revenue);
                
                // Merge update
                state.folders[idx] = { ...oldFolder, ...updatedFolder };

                if (viewsChanged || revenueChanged || assignmentChanged) {
                    if (revenueChanged) flashTitleNotification("💰 ДОХОД ОБНОВЛЕН");
                    else if (viewsChanged) flashTitleNotification("👁️ ПРОСМОТРЫ +");
                    else if (assignmentChanged) {
                        flashTitleNotification("🛰️ КАНАЛ НАЗНАЧЕН");
                        logStatus(`🛰️ Изменение владельца канала: ${updatedFolder.name}`, "info");
                    }
                }
            } else {
                // If we don't have it, add it (might be a new assignment)
                state.folders.unshift(updatedFolder);
            }
        } else if (payload.eventType === 'DELETE') {
            state.folders = state.folders.filter(f => String(f.id) !== String(payload.old.id));
        }
        
        // Instant UI Refresh
        if (state.activePage === 'account') renderAccountPage();
        if (state.activePage === 'partners') renderPartnersPage();
        if (state.activePage === 'videos') renderProjects();
        renderSidebarProfile();
    })
    .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
            console.warn("⚠️ Realtime Folders Error.");
            const cDot = document.getElementById('cloud-status-indicator');
            if (cDot) cDot.style.background = '#f59e0b';
        }
    });

    // Listen for Avatar changes
    cloudDB.channel('avatars-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_avatars' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            state.userAvatars[payload.new.login] = payload.new.avatar;
            if (state.activePage === 'account') renderAccountPage();
            if (state.activePage === 'partners') renderPartnersPage();
            renderSidebarProfile();
            console.log(`👤 [REALTIME] Avatar updated for: ${payload.new.login}`);
        }
    })
    .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') console.warn("⚠️ Realtime Avatars Error.");
    });

    // Listen for Project changes (Checkboxes, Status, Audio, etc.)
    cloudDB.channel('projects-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
        if (payload.eventType === 'INSERT') {
            if (!state.projects.find(p => p.id == payload.new.id)) {
                const p = payload.new;
                const data = p.data || {};
                state.projects.push({
                    ...p,
                    audioId: data.audioId,
                    scripts: data.scripts,
                    promptsList: data.promptsList,
                    results: data.results,
                    assets: data.assets
                });
                playNotificationSound();
                renderProjects();
                logStatus(`🆕 Новый проект: ${p.name}`, "success");
            }
        } else if (payload.eventType === 'UPDATE') {
            const updatedProj = payload.new;
            const existingIdx = state.projects.findIndex(p => p.id == updatedProj.id);
            if (existingIdx !== -1) {
                const oldProj = state.projects[existingIdx];
                const newData = updatedProj.data || {};
                state.projects[existingIdx] = { 
                    ...oldProj, 
                    ...updatedProj, 
                    audioId: newData.audioId, 
                    scripts: newData.scripts,
                    promptsList: newData.promptsList,
                    results: newData.results,
                    assets: newData.assets
                };
                if (updatedProj.status != oldProj.status) playNotificationSound();
                if (state.activeProjectId == updatedProj.id) {
                    if (state.activeProjectTab === 'voice') renderProjectVoice();
                    if (state.activeProjectTab === 'script') renderProjectScripts();
                    if (state.activeProjectTab === 'frames') renderProjectPrompts();
                }
                renderProjects();
            }
        } else if (payload.eventType === 'DELETE') {
            state.projects = state.projects.filter(p => p.id != payload.old.id);
            renderProjects();
        }
    })
    .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
            console.warn("⚠️ Realtime Projects Error.");
            logStatus("📡 Проблема с Realtime-синхронизацией. Обновите страницу, если данные не приходят.", "info");
        }
    });

}

let authState = JSON.parse(localStorage.getItem('animtube_auth') || '{"isLoggedIn": false, "user": null, "sessionStart": null, "lastActivity": null}');
let userIP = "detecting...";

async function detectIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
        console.log("📍 Current IP:", userIP);
    } catch (err) {
        console.error("Failed to detect IP:", err);
        userIP = "127.0.0.1";
    }
}

function checkSecurity() {
    const overlay = document.getElementById('auth-overlay');
    if (!authState.isLoggedIn) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    } else {
        overlay.style.display = 'none';
        applySecurityUI();
    }
}

async function handleLogin() {
    const login = document.getElementById('auth-login').value;
    const pass = document.getElementById('auth-pass').value;
    const code = document.getElementById('auth-code').value;
    const errorEl = document.getElementById('auth-error');

    // Find user in whitelist
    const user = WHITELIST.find(u => u.login === login && u.pass === pass && u.code === code);

    if (user) {
        // Check IP if not "*"
        if (user.ip !== "*" && user.ip !== userIP) {
            errorEl.innerText = `❌ Ошибка IP: Ваш IP (${userIP}) не совпадает с разрешенным.`;
            errorEl.style.display = 'block';
            return;
        }

        // Success
        authState = {
            isLoggedIn: true,
            user: { login: user.login, role: user.role },
            sessionStart: Date.now(),
            lastActivity: Date.now(),
            dateEntered: new Date().toLocaleDateString()
        };
        localStorage.setItem('animtube_auth', JSON.stringify(authState));
        
        // Non-blocking Cloud Sync
        loadState().then(() => {
            setupRealtimeSync(); // Start listening after first load
        }).catch(e => console.error("Initial cloud load failed:", e));
        
        applySecurityUI();
        renderAccountPage();
        renderSidebarProfile();
        document.getElementById('auth-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('auth-overlay').style.display = 'none';
        }, 500);
        logStatus(`👋 Добро пожаловать, ${user.login}!`, "success");
        
        // Initialize Chat System
        if (window.subscribeToGlobalMessages) window.subscribeToGlobalMessages();
    } else {
        errorEl.innerText = "❌ Неверные данные доступа.";
        errorEl.style.display = 'block';
    }
}

function applySecurityUI() {
    if (!authState.isLoggedIn) return;
    
    // Add role class to body
    document.body.classList.remove('role-owner', 'role-partner', 'role-manager');
    document.body.classList.add(`role-${authState.user.role}`);
    
    renderSidebarProfile();
    
    if (authState.user.login === "Alya Time") {
        document.getElementById('partner-hud').style.display = 'flex';
        startPartnerTimer();
    } else {
        document.getElementById('partner-hud').style.display = 'none';
    }
}

function renderSidebarProfile() {
    const user = authState.user;
    if (!user) return;

    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    
    if (nameEl) nameEl.innerText = user.login;
    if (roleEl) {
        roleEl.innerHTML = `@${user.login.toLowerCase()}`;
    }
    
    if (avatarEl) {
        const userAvatar = state.userAvatars[user.login];
        if (userAvatar) {
            avatarEl.src = userAvatar;
        } else {
            avatarEl.src = `https://ui-avatars.com/api/?name=${user.login}&background=6366f1&color=fff`;
        }
    }
}

function startPartnerTimer() {
    if (!authState || !authState.user || authState.user.login !== "Alya Time") {
        return; // Only Alya Time has a time limit
    }
    
    const today = new Date().toLocaleDateString();
    let usage = JSON.parse(localStorage.getItem('animtube_usage') || '{}');
    if (!usage[today]) usage[today] = 0; // seconds

    const MAX_SECONDS = 120 * 60; // 120 hours limit - wait, 120 minutes limit!

    const timerInterval = setInterval(() => {
        // Check if day changed while using
        const currentToday = new Date().toLocaleDateString();
        if (currentToday !== today) {
            location.reload(); // Simple day-reset
            return;
        }

        usage[today] += 1;
        localStorage.setItem('animtube_usage', JSON.stringify(usage));
        
        const remaining = MAX_SECONDS - usage[today];
        updateTimerUI(remaining);

        if (remaining <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Ваше время на сегодня закончилось (120 минут). Доступ заблокирован.");
            logout();
        }
    }, 1000);
}

function updateTimerUI(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const timeStr = [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
    
    const clock = document.getElementById('partner-timer-clock');
    if (clock) clock.innerText = timeStr;
    
    const hud = document.getElementById('partner-hud');
    if (seconds < 600) { // Last 10 mins
        hud.style.background = 'rgba(239, 68, 68, 0.3)';
    }
}

function logout() {
    localStorage.removeItem('animtube_auth');
    location.reload();
}



let state = {
    activePage: 'videos',
    projects: JSON.parse(localStorage.getItem('animtube_projects') || '[]'),
    folders: JSON.parse(localStorage.getItem('animtube_folders') || '[]'),
    userAvatars: JSON.parse(localStorage.getItem('animtube_user_avatars') || '{}'),
    currentFolderId: null,
    activeProjectId: null,
    assembly: {
        isRunning: false,
        timerId: null,
        countDown: 0,
        currentIdx: 0,
        queue: [],
        isWaitingForImage: false,
        lastSentPrompt: "",
        pendingImage: null,
        scriptQueue: 0,
        activeSplittingScriptId: null,
        pendingPrompts: "",
        superAuto: {
            active: false,
            count: 0,
            phase: 'idle', // 'scripts', 'splitting'
            splittingIdx: 0
        }
    },
    animAssembly: {
        isRunning: false,
        timerId: null,
        currentIdx: 0,
        lastProcessedIndex: -1,
        queue: [],
        lockedProjectId: null
    },
    isAutoMode: JSON.parse(localStorage.getItem('animtube_auto_mode') || 'false'),
    isInitialLoadComplete: false,
    isSyncInProgress: false
};

// --- GLOBAL EXPORTS (v1.4.0 Consolidated) ---
window.showPage = showPage;
window.switchProjectTab = switchProjectTab;
window.openProject = openProject;
window.openFolder = openFolder;
window.exitFolder = exitFolder;
window.createNewProject = createNewProject;
window.deleteProject = deleteProject;
window.deleteFolder = deleteFolder;
window.startRollAssembly = async () => {
    console.log("🚀 [HARD-LINK] Calling startRollAssembly...");
    if (typeof _startRollAssembly === 'function') return await _startRollAssembly();
    console.error("❌ _startRollAssembly is not defined!");
};
window.stopRollAssembly = (m) => typeof _stopRollAssembly === 'function' && _stopRollAssembly(m);
window.startAnimationAssembly = async () => {
    console.log("🚀 [HARD-LINK] Calling startAnimationAssembly...");
    if (typeof _startAnimationAssembly === 'function') return await _startAnimationAssembly();
    console.error("❌ _startAnimationAssembly is not defined!");
};
window.stopAnimationAssembly = (m) => typeof _stopAnimationAssembly === 'function' && _stopAnimationAssembly(m);
window.deleteFrame = (id) => typeof _deleteFrame === 'function' && _deleteFrame(id);
window.startScriptGeneration = startScriptGeneration;
window.addManualScenario = addManualScenario;
window.addPromptToProject = addPromptToProject;
window.renderProjectAnimation = renderProjectAnimation;
window.recreateSinglePrompt = recreateSinglePrompt;
window.handleAudioUpload = handleAudioUpload;
window.deleteProjectAudio = deleteProjectAudio;
window.renderProjectVoice = renderProjectVoice;
window.openSuperAutoModal = openSuperAutoModal;
window.closeSuperAutoModal = closeSuperAutoModal;
window.startSuperAutomation = startSuperAutomation;
window.downloadProjectFiles = downloadProjectFiles;
window.handleLogin = handleLogin;
window.logout = logout;
window.openFolderSettings = openFolderSettings;
window.closeFolderSettings = closeFolderSettings;
window.saveFolderSettings = saveFolderSettings;
window.openAccount = () => showPage('account');
window.openAvatarModal = openAvatarModal;
window.handleUserAvatarUpload = handleUserAvatarUpload;
window.submitUserAvatar = submitUserAvatar;
window.handleChannelAvatarUpload = handleChannelAvatarUpload;
window.closeCreateChannel = closeCreateChannel;
window.submitCreateChannel = submitCreateChannel;
window.enterChannel = (id) => { openFolder(id); showPage('videos'); };
window.createNewFolder = createNewFolder;
window.triggerVisualAssemblyStart = triggerVisualAssemblyStart;

const DEFAULT_PREFIX = "Create an image that closely resembles the style of the Peppa Pig cartoon, using the settings and art style of the Peppa Pig animated series: No text and a 1920×1080 frame. ";

// --- EXTENSION ROUTING (v1.3.2) ---
function sendToBridge(msg) {
    try {
        console.log("📤 [STUDIO -> BRIDGE]: Sending type =", msg.type, msg);
        window.postMessage(msg, "*");
    } catch (e) {
        console.error("❌ [BRIDGE ERROR]:", e);
        logStatus("🛰️ [Bridge Error]: " + e.message, "error");
    }
}

// --- INITIALIZE ---
window.onload = async () => {
    console.log("🚀 [SYSTEM]: AnimTube Initializing...");
    try {
        await initDB();
    } catch (e) { console.error("DB Init failed:", e); }
    
    // 1. Render UI immediately
    checkSecurity();
    renderProjects();
    setupGlobalListeners();
    updateAutoModeUI();

    // 2. Background tasks
    detectIP().catch(e => console.error("IP Detect failed:", e));

    if (authState.isLoggedIn) {
        renderAccountPage();
        renderSidebarProfile();
        loadState().catch(e => console.error("Initial load failed:", e));
        
        // AUTO-REFRESH for partners/managers every 30s
        if (authState.user.role !== 'owner') {
            setInterval(() => {
                if (authState.isLoggedIn) loadState();
            }, 30000);
        }

        // 3. Initialize Chat Subscription
        if (typeof subscribeToGlobalMessages === 'function') subscribeToGlobalMessages();
    }
    
    console.log("🚀 AnimTube v1.2.3 loaded.");
};

function setupGlobalListeners() {
    // Capture Slot Context Menu (Right Click guidance)
    const slot = document.getElementById('capture-slot');
    if (slot) {
        slot.addEventListener('contextmenu', (e) => {
            slot.focus();
            logStatus("🖱️ Используйте правую кнопку мыши -> Вставить (или Ctrl+V)", "info");
        });
    }

    const autoPasteBtn = document.getElementById('btn-auto-paste');
    if (autoPasteBtn) {
        autoPasteBtn.onclick = async () => {
            autoPasteBtn.classList.add('triggering');
            
            // 1. First, check our bridge cache (fastest)
            if (state.assembly.pendingImage) {
                logStatus("⌨️ Вставка кадра (AnimTube Bridge)...", "success");
                handleIncomingImage(state.assembly.pendingImage);
                state.assembly.pendingImage = null;
                setTimeout(() => autoPasteBtn.classList.remove('triggering'), 500);
                return;
            }

            // 2. FALLBACK: Direct System Clipboard Access (Ctrl+V logic)
            logStatus("⌨️ Чтение системного буфера обмена (Ctrl+V Mode)...", "info");
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    for (const type of item.types) {
                        if (type.startsWith("image/")) {
                            const blob = await item.getType(type);
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                handleIncomingImage(e.target.result);
                                logStatus("✅ Кадр успешно вставлен из буфера!", "success");
                                autoPasteBtn.classList.remove('triggering');
                            };
                            reader.readAsDataURL(blob);
                            return;
                        }
                    }
                }
                logStatus("⚠️ В буфере обмена нет картинки!", "error");
            } catch (err) {
                logStatus("⚠️ Ошибка доступа к буферу. Нажмите Ctrl+V вручную.", "error");
                console.error("Clipboard error:", err);
            }
            
            setTimeout(() => autoPasteBtn.classList.remove('triggering'), 500);
        };
    }

    // Manual Paste Listener
    document.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    handleIncomingImage(event.target.result);
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    // Extension Messaging Relay
    window.addEventListener("message", (event) => {
        if (!event.data) return;

        // 1. Status Reporting from Extension
        if (event.data.type === "ANIMTUBE_STATUS") {
            logStatus(event.data.text, "info");
            return;
        }

        // 2. Image Arrival (Internal transfer from ChatGPT)
        if (event.data.type === "FROM_CHATGPT") {
            console.log("📥 Image data received. Staging for landing...");
            state.assembly.pendingImage = event.data.base64;
            // We DON'T handle it yet. We wait for the Auto-Paste signal from the extension.
        }

        // 3. AUTO-PASTE SIGNAL (From Extension)
        if (event.data.type === "ANIMTUBE_CMD_PASTE_AUTO") {
            const btn = document.getElementById('btn-auto-paste');
            if (btn) btn.click();
        }

        // 3.1 SCRIPT AUTO-PASTE SIGNAL (v1.3.5)
        if (event.data.type === "ANIMTUBE_CMD_PASTE_SCRIPT_AUTO") {
            logStatus("🤖 [РОБОТ]: Авто-вставка сценария...", "info");
            const pasteBtns = document.querySelectorAll('.script-btn-paste');
            // Try to find the one that belongs to a pending script first
            let targetBtn = null;
            const pendingCard = document.querySelector('.script-card.pending'); 
            if (pendingCard) {
                targetBtn = pendingCard.querySelector('.script-btn-paste');
            } else if (pasteBtns.length > 0) {
                targetBtn = pasteBtns[0]; // Fallback to first one
            }
            
            if (targetBtn) {
                targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetBtn.classList.add('flash-active');
                setTimeout(() => {
                    targetBtn.click();
                    targetBtn.classList.remove('flash-active');
                }, 1000);
            }
        }

        // 3.2 GEMINI PROMPTS AUTO-PASTE SIGNAL (v1.3.6)
        if (event.data.type === "ANIMTUBE_CMD_PASTE_GEMINI_AUTO") {
            logStatus("🤖 [РОБОТ]: Авто-вставка промптов из Gemini...", "info");
            const scriptId = state.assembly.activeSplittingScriptId;
            if (scriptId) {
                const pasteBtn = document.getElementById(`btn-paste-split-${scriptId}`);
                const sendBtn = document.getElementById(`btn-distribute-split-${scriptId}`);
                
                if (pasteBtn) {
                    pasteBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    pasteBtn.classList.add('flash-active');
                    setTimeout(() => {
                        pasteBtn.click();
                        pasteBtn.classList.remove('flash-active');
                        
                        // Step 2: Send to Generator
                        setTimeout(() => {
                            if (sendBtn) {
                                logStatus("🤖 [РОБОТ]: Отправка промптов в генератор...", "info");
                                sendBtn.classList.add('flash-active');
                                setTimeout(() => {
                                    sendBtn.click();
                                    sendBtn.classList.remove('flash-active');
                                }, 800);
                            }
                        }, 1500);
                    }, 1000);
                }
            }
        }

        // 4. VISUAL COPY REQUEST (v11.15)
        if (event.data.type === "ANIMTUBE_CMD_VISUAL_COPY") {
            runVisualCopyAnimation(event.data.assetIds);
        }

        // 5. SCRIPT ARRIVAL (v12.0)
        if (event.data.type === "FROM_CHATGPT_SCRIPT") {
            handleIncomingScript(event.data.text);
        }

        // 6. ROBOT STATUS UPDATE (General Relay)
        if (event.data.type === "ANIMTUBE_STATUS") {
            const statusEl = document.getElementById('receiving-text') || document.getElementById('studio-terminal');
            if (statusEl) {
                if (statusEl.tagName === 'P' || statusEl.tagName === 'SPAN' || statusEl.id === 'receiving-text') {
                    statusEl.innerText = event.data.text.toUpperCase();
                } else {
                    logStatus(event.data.text, "info");
                }
            }
        }

        // 7. PROMPTS ARRIVAL (v1.2)
        if (event.data.type === "FROM_CHATGPT_PROMPTS" || event.data.type === "FROM_GEMINI_PROMPTS") {
            handleIncomingPrompts(event.data.text);
        }

        // 8. GROK ANIMATION ARRIVAL (Legacy Support)
        if (event.data.type === "FROM_GROK") {
            handleIncomingAnimation(event.data.base64);
        }

        // 9. GROK ANIMATION DOWNLOADED SIGNAL
        if (event.data.type === "FROM_GROK_DONE" || event.data.type === "FROM_GROK_AUTO_DONE") {
            // Guard: both extensions relay this signal — block duplicates with a time-lock
            if (window._grokDoneLock) {
                console.log("🔒 [GrokDone] Duplicate signal blocked.");
                return;
            }
            window._grokDoneLock = true;
            if (window.handleGrokDone) window.handleGrokDone();
        }
    });
}

// --- SCRIPT MANAGEMENT ---
function startScriptGeneration(isAutomatic = false) {
    const project = getCurrentProject();
    if (!project) return;

    if (!isAutomatic) {
        // Initial manual click: Check the UI for count
        const countInput = document.getElementById('script-count');
        const count = parseInt(countInput.value) || 1;
        state.assembly.scriptQueue = count - 1;
    }

    const folder = getFolderForProject(project.id);
    const prefix = folder ? folder.scriptPrefix : "Напиши сценарий для серии...";
    
    // UI: Create a PENDING script card at the TOP
    if (!project.scripts) project.scripts = [];
    const nextNum = project.scripts.length + 1;
    
    const pendingScript = {
        id: "pending-" + Date.now(),
        isPending: true,
        text: "Ожидание возврата робота из ChatGPT...",
        scriptNum: nextNum,
        created: new Date().toLocaleTimeString()
    };
    
    project.scripts.unshift(pendingScript);
    if (project.status < 1) project.status = 1;
    saveState();
    
    // v1.3.3: Small timeout to ensure tab switch DOM is ready
    setTimeout(() => {
        renderProjectScripts();
        logStatus("📝 Запуск генерации сценария в ChatGPT...", "info");
        
        sendToBridge({ 
            type: "ANIMTUBE_CMD_SCRIPT", 
            msgId: Date.now() + "-" + Math.random(),
            prefix: prefix 
        });
    }, 200);
}

function handleIncomingScript(text) {
    const project = getCurrentProject();
    if (!project) return;

    // Find the pending slot (the first one)
    const pendingIdx = project.scripts.findIndex(s => s.isPending);
    
    if (pendingIdx !== -1) {
        project.scripts[pendingIdx].isPending = false;
        project.scripts[pendingIdx].text = text;
        project.scripts[pendingIdx].id = Date.now(); // Replace placeholder ID
    } else {
        // Fallback: just add a new one
        const newScript = {
            id: Date.now(),
            text: text,
            created: new Date().toLocaleTimeString()
        };
        if (!project.scripts) project.scripts = [];
        project.scripts.unshift(newScript);
    }
    
    if (project.status < 1) project.status = 1;
    saveState();
    renderProjectScripts();
    logStatus("✅ Сценарий успешно вставлен в слот!", "success");

    // BULK GENERATION (v1.1)
    if (state.assembly.scriptQueue > 0) {
        const remaining = state.assembly.scriptQueue;
        state.assembly.scriptQueue--; 
        logStatus(`⏳ Авто-запуск следующей генерации... Осталось ещё: ${remaining}`, "info");
        setTimeout(() => {
            if (state.activeProjectId === project.id) {
                startScriptGeneration(true);
            } else {
                state.assembly.scriptQueue = 0;
            }
        }, 3000);
        return;
    }

    // --- SUPER AUTOMATION: Transition to Phase 2 (Splitting) ---
    if (state.assembly.superAuto.active && state.assembly.superAuto.phase === 'scripts') {
        logStatus("🤖 [СУПЕР-АВТО]: Сценарий получен! Перехожу к разделению...", "success");
        state.assembly.superAuto.phase = 'splitting';
        state.assembly.superAuto.splittingIdx = 0;
        
        setTimeout(() => {
            switchProjectTab('prompts');
            processSuperAutoSplitting();
        }, 3000);
    }
}

// --- NEW: ROBOTIC ASSEMBLY TRIGGER (v1.3.2) ---
function triggerVisualAssemblyStart() {
    logStatus("🤖 [РОБОТ]: Перехожу к финальной сборке (Фаза 4)...", "success");
    
    // 1. Switch Tab to Frames
    switchProjectTab('frames');
    
    setTimeout(() => {
        // 2. USER REQUEST: Explicit Scroll Down to find the button
        logStatus("🖱️ [РОБОТ]: Прокрутка вниз к кнопке пуска...", "info");
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        
        setTimeout(() => {
            const btnStart = document.getElementById('btn-start-assembly');
            if (btnStart) {
                // 3. Highlight and Final Scroll Adjustment
                btnStart.scrollIntoView({ behavior: 'smooth', block: 'center' });
                btnStart.classList.add('flash-active');
                logStatus("🖱️ [РОБОТ]: Кнопка пуска найдена. Нажимаю...", "success");
                
                setTimeout(() => {
                    btnStart.classList.remove('flash-active');
                    // 4. THE VITAL CLICK (Zero-Click Production Start)
                    btnStart.click(); 
                    logStatus("🏁 [РОБОТ]: Сборка запущена. Приятного просмотра!", "success");
                }, 1200);
            } else {
                logStatus("ℹ️ [РОБОТ]: Сборка уже активна.", "success");
            }
        }, 1500); // Wait for scroll to finish
    }, 1000); // Wait for tab switch/render
}

// --- NEW: SUPER AUTOMATION SPLITTING LOOP ---
function processSuperAutoSplitting() {
    if (!state.assembly.superAuto.active || state.assembly.superAuto.phase !== 'splitting') return;

    const project = getCurrentProject();
    const scripts = project.scripts || [];
    const idx = state.assembly.superAuto.splittingIdx;

    if (idx >= scripts.length) {
        logStatus("🤖 [СУПЕР-АВТО]: Все сценарии разделены!", "success");
        return; 
    }

    const targetScript = scripts[idx];
    if (targetScript.isPending) {
        logStatus(`⏳ [СУПЕР-АВТО]: Ожидание готовности сценария #${idx + 1}...`, "info");
        setTimeout(processSuperAutoSplitting, 2000);
        return;
    }

    logStatus(`🤖 [СУПЕР-АВТО]: Разделяю сценарий ${idx + 1}/${scripts.length}...`, "info");
    startScriptSplitting(targetScript.id);
}

// --- PROMPT SPLITTING (v1.2) ---
function renderProjectScenariosForSplitting() {
    const project = getCurrentProject();
    const container = document.getElementById('scenarios-splitting-container');
    if (!project || !container) return;

    if (!project.scripts || project.scripts.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-dim); padding: 40px;">Сценарии еще не добавлены. Загрузите .txt или создайте сценарий в первой вкладке.</p>`;
        return;
    }

    container.innerHTML = project.scripts.map((s, idx) => {
        const preview = s.text.substring(0, 80) + (s.text.length > 80 ? "..." : "");
        const scriptNum = s.scriptNum || (project.scripts.length - idx);

        return `
            <div class="scenario-split-card">
                <div class="scenario-split-info">
                    <div class="scenario-split-name">СЦЕНАРИЙ #${scriptNum}</div>
                    <div class="scenario-split-preview">${preview}</div>
                </div>
                    <button id="copy-btn-split-${s.id}" class="btn btn-secondary" onclick="copyScriptToClipboard('${s.id}')" title="Копировать текст">
                        📋
                    </button>
                    <button class="btn btn-secondary" onclick="startScriptSplitting('${s.id}')">
                        ✂️ Разделить на промпты
                    </button>
                    <button class="btn btn-danger" onclick="deleteScript('${s.id}')" style="padding: 10px;">🗑️</button>
                </div>
            </div>
            
            <div id="frames-grid-${s.id}" class="scenario-frames-grid" style="display: block;">
                <div class="bulk-paste-area">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 15px;">
                        <div class="frame-label" style="color: var(--accent-gemini); flex: 1;">📥 МАССОВАЯ ВСТАВКА (GEMINI)</div>
                        <div style="display: flex; gap: 10px;">
                            <button id="btn-paste-split-${s.id}" class="btn btn-gemini" onclick="pasteFromGeminiToScenario('${s.id}')" style="padding: 8px 16px; font-size: 11px;">
                                📥 ВСТАВИТЬ (GEMINI)
                            </button>
                            <button id="btn-distribute-split-${s.id}" class="btn btn-primary" onclick="distributePromptsToGenerator('${s.id}', document.getElementById('bulk-textarea-${s.id}').value)" style="padding: 8px 16px; font-size: 11px;">
                                🧩 ОТПРАВИТЬ В ГЕНЕРАТОР
                            </button>
                        </div>
                    </div>
                    <textarea id="bulk-textarea-${s.id}" class="bulk-textarea" 
                              placeholder="Вставьте сюда текст из Gemini..." 
                              oninput="autoResizeTextarea(this)"></textarea>
                </div>
            </div>
        `;
    }).join("");
}

function handleScenarioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        if (text.length < 10) return alert("Файл слишком короткий!");

        const project = getCurrentProject();
        if (!project) return;

        if (!project.scripts) project.scripts = [];
        project.scripts.unshift({
            id: Date.now(),
            text: text,
            created: new Date().toLocaleTimeString(),
            scriptNum: project.scripts.length + 1,
            frames: Array(20).fill(""),
            isFramesExpanded: false
        });

        if (project.status < 1) project.status = 1;
        saveState();
        renderProjectScripts();
        renderProjectScenariosForSplitting();
        logStatus("✅ Сценарий успешно загружен из файла!", "success");
    };
    reader.readAsText(file);
}

function addManualScenario() {
    const text = prompt("Введите текст сценария:");
    if (!text || text.length < 10) return;

    const project = getCurrentProject();
    if (!project) return;

    if (!project.scripts) project.scripts = [];
    project.scripts.unshift({
        id: Date.now(),
        text: text,
        created: new Date().toLocaleTimeString(),
        scriptNum: project.scripts.length + 1,
        frames: Array(20).fill(""),
        isFramesExpanded: false
    });

    if (project.status < 1) project.status = 1;
    saveState();
    renderProjectScripts();
    renderProjectScenariosForSplitting();
    logStatus("✅ Сценарий успешно добавлен вручную!", "success");
}

function distributePromptsToGenerator(scriptId, rawText) {
    const project = getCurrentProject();
    if (!project) return;
    
    // v1.3.0: New Line-based Splitting
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    
    if (lines.length === 0) {
        logStatus("⚠️ Не найдено контента для распределения.", "error");
        return;
    }

    if (!project.promptsList) project.promptsList = [];
    
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;

    // Add new lines to the project's prompt list
    lines.forEach(line => {
        // Clean up markdown/noise
        const clean = line.replace(/^[:\s\-*]+/, '').trim();
        if (clean) {
            project.promptsList.push({
                text: (prefix.trim() + "\n\n" + clean).trim(),
                isGeminiDone: false,
                isGrokDone: false,
                resultId: null
            });
        }
    });

    saveState();
    
    // Clear the textarea
    const textarea = document.getElementById(`bulk-textarea-${scriptId}`);
    if (textarea) textarea.value = "";
    
    logStatus(`✅ Добавлено ${lines.length} промптов в генератор!`, "success");
    
    // 🚀 THE LITERAL HANDSHAKE: Always transition to assembly after distribution
    triggerVisualAssemblyStart();
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

async function pasteFromGeminiToScenario(scriptId) {
    const btn = document.getElementById(`btn-paste-split-${scriptId}`);
    if (btn) btn.classList.add('triggering');

    let text = state.assembly.pendingPrompts;
    
    // Fallback to Clipboard
    if (!text || text.length < 5) {
        logStatus("📋 Буфер пуст, пробую системный буфер...", "info");
        try {
            text = await navigator.clipboard.readText();
        } catch (e) {
            logStatus("❌ Ошибка буфера. Используйте Ctrl+V в поле.", "error");
        }
    }

    if (text && text.length > 5) {
        const textarea = document.getElementById(`bulk-textarea-${scriptId}`);
        if (textarea) {
            textarea.value = text;
            autoResizeTextarea(textarea);
        }
        logStatus("📥 Текст вставлен! Нажмите «Отправить в Генератор» для распределения.", "success");
    } else {
        logStatus("⚠️ В буфере не найдено подходящего текста.", "error");
    }

    if (btn) setTimeout(() => btn.classList.remove('triggering'), 500);
}

function startScriptSplitting(scriptId) {
    const project = getCurrentProject();
    if (!project) return;
    
    const script = project.scripts.find(s => s.id == scriptId);
    if (!script) return;
    
    const text = script.text;
    if (!text || text.length < 10) return alert("Текст слишком короткий для разделения!");
    
    // STEP 1: UI Robotic Effect
    document.body.classList.add('robotic-moving');
    state.assembly.activeSplittingScriptId = scriptId;
    
    const copyBtn = document.getElementById(`copy-btn-split-${scriptId}`);
    if (copyBtn) copyBtn.classList.add('triggering');

    logStatus("🤖 РОБОТ: Активация... Шаг 1: Копирование сценария.", "info");

    // Copy to clipboard
    setTimeout(() => {
        copyScriptToClipboard(scriptId);
        
        if (copyBtn) copyBtn.classList.remove('triggering');

    // STEP 2 & 3: Switch & Send to ChatGPT
    setTimeout(() => {
        logStatus("🚀 Шаг 2: Переход в Gemini. Шаг 3: Вставка сценария...", "success");
        
        // v1.2.3: Use Folder-level split instruction
        const folder = getFolderForProject(state.activeProjectId);
        const splitPrefix = (folder && folder.splitPrefix) ? folder.splitPrefix : "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.";

        sendToBridge({ 
            type: "ANIMTUBE_CMD_SPLIT", 
            msgId: Date.now() + "-" + Math.random(),
            script: text,
            prefix: splitPrefix
        });
        
        // Cleanup UI shift after start
        setTimeout(() => {
            document.body.classList.remove('robotic-moving');
        }, 2000);
    }, 800);
}, 400);
}

function handleIncomingPrompts(rawText) {
    // Store for manual/auto distribution
    state.assembly.pendingPrompts = rawText;
    
    // Automated Splitting Bridge
    if (state.assembly.activeSplittingScriptId) {
        const sid = state.assembly.activeSplittingScriptId;
        logStatus("🤖 РОБОТ: Данные получены! Авто-вставка и отправка в генератор...", "success");
        
        setTimeout(() => {
            // 1. Robotic Click on "Paste" button
            const pBtn = document.getElementById(`btn-paste-split-${sid}`);
            if (pBtn) pBtn.click(); 

            setTimeout(() => {
                // 2. Robotic Click on "Distribute" button
                const btnDist = document.getElementById(`btn-distribute-split-${sid}`);
                if (btnDist) {
                    btnDist.click(); 
                    // Note: distributePromptsToGenerator now handles the Phase 4 transition & loop continue
                }
                
                state.assembly.activeSplittingScriptId = null;
                state.assembly.pendingPrompts = null;
                
                // --- SUPER AUTOMATION: Continue Loop or Finish ---
                if (state.assembly.superAuto.active && state.assembly.superAuto.phase === 'splitting') {
                    state.assembly.superAuto.splittingIdx++;
                    const project = getCurrentProject();
                    if (project && project.scripts && state.assembly.superAuto.splittingIdx < project.scripts.length) {
                        logStatus(`🤖 [СУПЕР-АВТО]: Перехожу к следующему сценарию (#${state.assembly.superAuto.splittingIdx + 1})...`, "info");
                        setTimeout(processSuperAutoSplitting, 2000);
                    } else {
                        logStatus("🤖 [СУПЕР-АВТО]: Все сценарии разделены! Перехожу к генерации кадров...", "success");
                        state.assembly.superAuto.phase = 'frames';
                        // Transition to Phase 4 (Frames) is already triggered by distributePromptsToGenerator -> triggerVisualAssemblyStart
                    }
                } else {
                    state.assembly.superAuto.active = false;
                    state.assembly.superAuto.phase = 'idle';
                }
            }, 1500);
        }, 500);
        return;
    }

    // Fallback: direct injection into project prompt list
    const project = getCurrentProject();
    if (!project) return;

    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;

    const newObjects = lines.map(l => ({
        text: (prefix.trim() + "\n\n" + l.trim()).trim(),
        isGeminiDone: false,
        isGrokDone: false,
        resultId: null
    }));

    if (!project.promptsList) project.promptsList = [];
    project.promptsList = [...project.promptsList, ...newObjects];
    
    saveState();
    renderProjectPrompts();
    logStatus(`✅ Разделено на ${lines.length} промптов!`, "success");
}

function toggleAutoMode() {
    state.isAutoMode = !state.isAutoMode;
    localStorage.setItem('animtube_auto_mode', state.isAutoMode);
    updateAutoModeUI();
    logStatus(state.isAutoMode ? "✨ Режим автоматизации ВКЛ" : "🌑 Режим автоматизации ВЫКЛ", "info");
}

function updateAutoModeUI() {
    const btn = document.getElementById('btn-automation-toggle');
    if (btn) {
        if (state.isAutoMode) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}


async function pasteScriptFromClipboard(id) {
    try {
        const text = await navigator.clipboard.readText();
        if (!text || text.length < 5) {
            logStatus("⚠️ Буфер обмена пуст или содержит слишком короткий текст.", "error");
            return;
        }

        const project = getCurrentProject();
        const script = project.scripts.find(s => s.id == id || s.id === id);
        
        if (script) {
            script.text = text;
            script.isPending = false;
            saveState();
            renderProjectScripts();
            logStatus("✅ Сценарий успешно вставлен из буфера обмена!", "success");
        }
    } catch (err) {
        logStatus("❌ Ошибка доступа к буферу. Разрешите доступ в браузере.", "error");
        console.error("Clipboard error:", err);
    }
}

function renderProjectScripts() {
    const project = getCurrentProject();
    const container = document.getElementById('project-scripts-container');
    if (!project || !container) return;

    if (!project.scripts || project.scripts.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-dim); padding: 40px;">Сценарии еще не созданы. Нажмите кнопку выше, чтобы начать.</p>`;
        return;
    }

    container.innerHTML = project.scripts.map((s, idx) => {
        const scriptNum = s.scriptNum || (project.scripts.length - idx);
        const isCollapsed = s.isCollapsed ?? false; // Default expanded for single scenario
        const isPending = s.isPending;
        
        return `
        <div class="script-card ${isCollapsed ? 'collapsed' : 'expanded'} ${isPending ? 'pending' : ''}" id="script-card-${s.id}">
            <div class="script-header" onclick="toggleScript('${s.id}')">
                <span style="font-weight: 800; color: var(--accent-chatgpt);">СЦЕНАРИЙ #${scriptNum}</span>
                <span style="opacity: 0.5; font-size: 11px; margin-left: 10px;">${s.created}</span>
                <span id="script-status-${s.id}" style="margin-left: auto; font-size: 11px; font-weight: 800;">
                    ${isPending ? '⌛ ОЖИДАНИЕ РОБОТА...' : '✅ ГОТОВО'}
                </span>
                <span class="script-toggle-icon" style="margin-left: 15px;">${isCollapsed ? '▼' : '▲'}</span>
            </div>
            
            <div class="script-body">
                <textarea 
                    class="script-textarea" 
                    id="script-textarea-${s.id}" 
                    placeholder="Напишите сценарий здесь или дождитесь робота..."
                    oninput="updateScriptText('${s.id}', this.value)"
                >${s.text}</textarea>
                
                <div class="script-actions" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="script-btn script-btn-paste" onclick="pasteScriptFromClipboard('${s.id}')" style="background: var(--accent-chatgpt); color: white; border: none; flex: 1.5; font-weight: 800;">
                        📥 ВСТАВИТЬ (CHATGPT)
                    </button>
                    <button class="script-btn script-btn-copy" onclick="copyScriptToClipboard('${s.id}')" style="flex: 1;">📋 Копировать</button>
                    <button class="script-btn script-btn-download" onclick="downloadScript('${s.id}')" style="flex: 1;">📥 .txt</button>
                    <button class="script-btn script-btn-del" onclick="deleteScript('${s.id}')" style="flex: 0.5;">🗑️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function updateScriptText(id, newText) {
    const project = getCurrentProject();
    if (!project || !project.scripts) return;
    const script = project.scripts.find(s => s.id == id || s.id === id);
    if (script) {
        script.text = newText;
        saveState();
    }
}

function toggleScript(id) {
    const project = getCurrentProject();
    const script = project.scripts.find(s => s.id == id);
    if (script) {
        script.isCollapsed = !(script.isCollapsed ?? true);
        saveState();
        renderProjectScripts();
    }
}

function downloadScript(id) {
    const project = getCurrentProject();
    const script = project.scripts.find(s => s.id == id);
    if (!script) return;

    const blob = new Blob([script.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scenario_${project.name}_${script.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logStatus("💾 Файл сценария сохранен.", "success");
}

function copyScriptToClipboard(id) {
    const project = getCurrentProject();
    const script = project.scripts.find(s => s.id == id);
    if (script) {
        navigator.clipboard.writeText(script.text);
        logStatus("📋 Сценарий скопирован в буфер обмена.", "success");
    }
}

function deleteScript(id) {
    if (!confirm("Удалить этот сценарий?")) return;
    const project = getCurrentProject();
    project.scripts = project.scripts.filter(s => s.id != id);
    if ((!project.scripts || project.scripts.length === 0) && project.status === 1) {
        project.status = 0;
    }
    saveState();
    renderProjectScripts();
}

async function initDB() {
    return new Promise((resolve, reject) => {
        // v3.0: High-Capacity Persistence Layer (Metadata & Images)
        const request = indexedDB.open("AnimTubeDB", 3);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("images")) {
                db.createObjectStore("images", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("assets")) {
                db.createObjectStore("assets", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("animations")) {
                db.createObjectStore("animations", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("audio")) {
                db.createObjectStore("audio", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("projects_meta")) {
                db.createObjectStore("projects_meta", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => {
            console.error("IndexedDB error:", e);
            reject(e);
        };
    });
}

async function saveAudioToDB(id, base64) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["audio"], "readwrite");
        const store = transaction.objectStore("audio");
        const request = store.put({ id, base64 });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e);
    });
}

async function getAudioFromDB(id) {
    return new Promise(async (resolve, reject) => {
        const transaction = db.transaction(["audio"], "readonly");
        const store = transaction.objectStore("audio");
        const request = store.get(id);
        request.onsuccess = async () => {
            if (request.result) {
                resolve(request.result.base64);
            } else {
                const cloudAudio = await getAudioFromCloud(id);
                if (cloudAudio) {
                    await saveAudioToDB(id, cloudAudio);
                    resolve(cloudAudio);
                } else {
                    resolve(null);
                }
            }
        };
        request.onerror = (e) => reject(e);
    });
}

async function saveAudioToCloud(id, base64) {
    if (!cloudDB) cloudDB = getDB();
    if (!cloudDB) return;
    try {
        await cloudDB.from('project_audio').upsert([{ id, base64, created_at: new Date().toISOString() }]);
    } catch (e) {
        console.error("Cloud Audio Save Error:", e);
    }
}

async function getAudioFromCloud(id) {
    if (!cloudDB) cloudDB = getDB();
    if (!cloudDB) return null;
    try {
        const { data, error } = await cloudDB.from('project_audio').select('base64').eq('id', id).single();
        if (error || !data) return null;
        return data.base64;
    } catch (e) {
        return null;
    }
}

async function saveImageToDB(id, base64) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");
        const request = store.put({ id, base64 });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e);
    });
}

async function getImageFromDB(id) {
    return new Promise(async (resolve, reject) => {
        const transaction = db.transaction(["images"], "readonly");
        const store = transaction.objectStore("images");
        const request = store.get(id);
        request.onsuccess = async () => {
            if (request.result) {
                resolve(request.result.base64);
            } else {
                // FALLBACK: Try cloud if not found in IndexedDB
                const cloudImg = await getImageFromCloud(id);
                if (cloudImg) {
                    await saveImageToDB(id, cloudImg); // Cache it
                    resolve(cloudImg);
                } else {
                    resolve(null);
                }
            }
        };
        request.onerror = (e) => reject(e);
    });
}

async function saveImageToCloud(id, base64) {
    if (!cloudDB) cloudDB = getDB();
    if (!cloudDB) return;
    try {
        await cloudDB.from('project_images').upsert([{ id, base64, created_at: new Date().toISOString() }]);
    } catch (e) {
        console.error("Cloud Image Save Error:", e);
    }
}

async function getImageFromCloud(id) {
    if (!cloudDB) cloudDB = getDB();
    if (!cloudDB) return null;
    try {
        const { data, error } = await cloudDB.from('project_images').select('base64').eq('id', id).single();
        if (error || !data) return null;
        return data.base64;
    } catch (e) {
        return null;
    }
}

async function saveAnimationToDB(id, base64) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["animations"], "readwrite");
        const store = transaction.objectStore("animations");
        const request = store.put({ id, base64 });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e);
    });
}

async function getAnimationFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["animations"], "readonly");
        const store = transaction.objectStore("animations");
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.base64);
        request.onerror = () => reject(e);
    });
}

// --- NAVIGATION ---
function showPage(pageId) {
    state.activePage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) pageEl.classList.add('active');
    
    const navItem = document.getElementById(`nav-${pageId}`);
    if (navItem) navItem.classList.add('active');
    
    if (pageId === 'videos') renderProjects();
    if (pageId === 'partners') renderPartnersPage();
    if (pageId === 'account') renderAccountPage();
    if (pageId === 'workspace') {
        renderProjectScripts();
        renderProjectLibrary();
        renderProjectAssets();
    }
}

function switchProjectTab(tabId) {
    // Navigation Guard
    // Navigation Guard (v15 Access Control)
    const role = authState.user?.role;
    // Script tab restriction removed per user request

    // 1. Update Tab Buttons
    state.activeProjectTab = tabId; 
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const tabItem = document.getElementById(`tab-${tabId}`);
    if (tabItem) tabItem.classList.add('active');

    // 2. Update Content Panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    if (tabId === 'script') {
        const pane = document.getElementById('tab-content-script');
        if (pane) pane.classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectScripts();
    } else if (tabId === 'voice') {
        const pane = document.getElementById('tab-content-voice');
        if (pane) pane.classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectVoice(); 
    } else if (tabId === 'prompts') {
        const pane = document.getElementById('tab-content-prompts');
        if (pane) pane.classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectScenariosForSplitting();
    } else if (tabId === 'frames') {
        const pane = document.getElementById('tab-content-frames');
        if (pane) pane.classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'block';
        renderProjectPrompts();
    } else if (tabId === 'animation') {
        const pane = document.getElementById('tab-content-animation');
        if (pane) pane.classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectAnimation();
    }

    logStatus(`📂 Переход во вкладку: ${tabId}`, "info");
}

function getFolderForProject(projectId) {
    const project = state.projects.find(p => p.id == projectId);
    if (!project || !project.folderId) return null;
    const folder = state.folders.find(f => f.id == project.folderId);
    
    // v1.9.2: Ultra-Robust Alphanumeric Match
    if (folder && (!folder.uploadLink || folder.uploadLink.trim() === "")) {
        const clean = (s) => s.toString().toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
        const target = clean(folder.name);
        
        for (const [key, link] of Object.entries(HARDCODED_LINKS)) {
            if (clean(key) === target) {
                folder.uploadLink = link;
                console.log(`🔗 Hardcoded link injected for: ${folder.name}`);
                break;
            }
        }
    }
    
    return folder;
}

// --- CHANNEL MANAGEMENT (v1.4) ---
let currentChannelAvatar = null;
let currentChannelColor = '#6366f1';
let tempFolderAvatar = null; // v2.0: For editing existing folder avatars

function createNewFolder() {
    if (authState.user.role !== 'owner' && authState.user.role !== 'manager') {
        alert("🚫 Создавать новые каналы может только Владелец или Менеджер.");
        return;
    }
    
    // Reset modal
    document.getElementById('new-channel-name').value = "";
    document.getElementById('new-channel-niche').value = "";
    document.getElementById('channel-avatar-preview').innerHTML = '<span style="font-size: 30px;">🖼️</span>';
    document.getElementById('channel-avatar-preview').style.borderColor = 'var(--border-glass)';
    currentChannelAvatar = null;
    currentChannelColor = '#6366f1';

    document.getElementById('create-channel-overlay').style.display = 'flex';
}

function closeCreateChannel() {
    document.getElementById('create-channel-overlay').style.display = 'none';
}

async function handleChannelAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imgUrl = e.target.result;
            try {
                logStatus("⌛ Сжатие иконки канала...", "info");
                const compressed = await compressImage(imgUrl, 400, 0.7);
                currentChannelAvatar = compressed;
                document.getElementById('channel-avatar-preview').innerHTML = `<img src="${compressed}" style="width:100%; height:100%; object-fit:cover;">`;
                
                // Extract dominant color
                extractDominantColor(compressed, (color) => {
                    currentChannelColor = color;
                    document.getElementById('channel-avatar-preview').style.borderColor = color;
                    document.getElementById('channel-avatar-preview').style.boxShadow = `0 0 20px ${color}44`;
                });
            } catch (err) {
                console.error("Folder avatar compression failed:", err);
                currentChannelAvatar = imgUrl;
                document.getElementById('channel-avatar-preview').innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function handleFolderSettingsAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imgUrl = e.target.result;
            try {
                logStatus("⌛ Сжатие новой иконки...", "info");
                const compressed = await compressImage(imgUrl, 400, 0.7);
                tempFolderAvatar = compressed;
                const preview = document.getElementById('folder-settings-avatar-preview');
                if (preview) preview.innerHTML = `<img src="${compressed}" style="width:100%; height:100%; object-fit:cover;">`;
            } catch (err) {
                console.error("Folder settings avatar compression failed:", err);
                tempFolderAvatar = imgUrl;
                const preview = document.getElementById('folder-settings-avatar-preview');
                if (preview) preview.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function extractDominantColor(imgUrl, callback) {
    const img = new Image();
    img.src = imgUrl;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        
        let r=0, g=0, b=0;
        for(let i=0; i<data.length; i+=4) {
            r += data[i]; g += data[i+1]; b += data[i+2];
        }
        r = Math.floor(r/(data.length/4));
        g = Math.floor(g/(data.length/4));
        b = Math.floor(b/(data.length/4));
        
        // Ensure color is not too dark
        const brightness = (r*299 + g*587 + b*114) / 1000;
        if (brightness < 80) { r += 50; g += 50; b += 50; }
        
        callback(`rgb(${r}, ${g}, ${b})`);
    };
}

function submitCreateChannel() {
    const name = document.getElementById('new-channel-name').value.trim();
    const niche = document.getElementById('new-channel-niche').value.trim();
    
    if (!name) {
        alert("Пожалуйста, введите название канала.");
        return;
    }

    const newFolder = {
        id: Date.now(),
        name: name,
        niche: niche || "Без ниши",
        avatar: currentChannelAvatar,
        color: currentChannelColor,
        ownedBy: authState.user ? authState.user.login : null,
        assignedTo: null,
        prefix: "Create an image that closely resembles the style of the Peppa Pig cartoon, using the settings and art style of the Peppa Pig animated series: No text and a 1920×1080 frame. Делай в разных ракурсах, немного видоизменяй с предыдущего кадра",
        scriptPrefix: "Create another script based on a new idea: \n-\nAt least 2,500 characters for the Russian version and 2,500 characters for the English version, for a total of 5,000 characters",
        splitPrefix: "Тут 2 части одного сценария, работай только над одной, английской версией не трогая первую русскую половину. каждый промт сплошным текстом I need to create storyboards for my video based on the Peppa Pig animated series. Could you divide my script into 20 equal parts? Specify the room where the action takes place, such as: kitchen, livingroom, childrenroom, hallway For each part, please provide a written description of what the frame should look like—without any text or other elements—and specify the location, characters, and action. Write each frame as a single block of text; start each new one on a new line, and do this for all 20 of them. Называй локации именно так: Kitchen livingroom childrenroom hallway, если в этом моменте нет ни одной из локации, не называй её",
        created: new Date().toLocaleDateString()
    };

    state.folders.unshift(newFolder);
    saveState();
    logStatus(`✅ Канал "${name}" успешно создан!`, "success");
    closeCreateChannel();
    renderProjects();
    
    if (state.activePage === 'account') renderAccountPage();
}

// --- USER AVATAR MANAGEMENT (v1.5) ---
activeAvatarTarget = null; // null for self, or login for partner

function openAvatarModal(targetLogin = null) {
    activeAvatarTarget = targetLogin;
    const title = targetLogin ? `Аватар для ${targetLogin}` : "Ваш аватар";
    document.getElementById('avatar-modal-title').innerText = title;
    document.getElementById('avatar-upload-overlay').style.display = 'flex';
}

function closeAvatarModal() {
    document.getElementById('avatar-upload-overlay').style.display = 'none';
}

async function handleUserAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64 = e.target.result;
            const targetLogin = activeAvatarTarget || authState.user.login;
            
            logStatus(`⌛ Обновление аватара для ${targetLogin}...`, "info");
            
            // 1. Update local state with compressed version (v1.6)
            try {
                const compressedBase64 = await compressImage(base64, 400, 0.6); // Avatars don't need high res
                state.userAvatars[targetLogin] = compressedBase64;
                
                // 2. Immediate Cloud Push
                if (cloudDB && authState.isLoggedIn) {
                    const { error: upsertErr } = await cloudDB.from('user_avatars').upsert(
                        [{ login: targetLogin, avatar: compressedBase64 }], 
                        { onConflict: 'login' }
                    );
                    if (upsertErr) throw upsertErr;
                    logStatus(`✅ Аватар ${targetLogin} сохранен в облаке!`, "success");
                }
            } catch (err) {
                console.error("Avatar Cloud Sync Error:", err);
                state.userAvatars[targetLogin] = base64; // Fallback to original locally
                logStatus("⚠️ Ошибка сжатия или синхронизации: " + err.message, "error");
            }
            
            saveState(); // General backup
            renderAccountPage();
            renderSidebarProfile();
            closeAvatarModal();
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function submitUserAvatar() {
    document.getElementById('user-avatar-input').click();
}

function openFolder(id) {
    state.currentFolderId = id;
    renderProjects();
}

function exitFolder() {
    state.currentFolderId = null;
    renderProjects();
}

// --- FOLDER SETTINGS (v1.3.8) ---
function openFolderSettings(id) {
    const folder = state.folders.find(f => f.id == id);
    if (!folder) {
        console.error("Folder not found for settings:", id);
        return;
    }

    state.activeFolderIdForSettings = id;
    
    document.getElementById('folder-settings-title').innerText = `⚙️ ${folder.name.toUpperCase()}`;
    document.getElementById('folder-prompt-prefix').value = folder.prefix || "";
    document.getElementById('folder-script-prefix').value = folder.scriptPrefix || "";
    document.getElementById('folder-split-prefix').value = folder.splitPrefix || "";
    
    // v2.0: Setup Avatar Preview
    tempFolderAvatar = folder.avatar;
    const preview = document.getElementById('folder-settings-avatar-preview');
    if (preview) {
        if (folder.avatar) {
            preview.innerHTML = `<img src="${folder.avatar}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            preview.innerHTML = `<span style="font-size: 24px;">🖼️</span>`;
        }
    }
    
    const uploadInput = document.getElementById('folder-upload-link');
    if (uploadInput) {
        let link = folder.uploadLink || "";
        // v1.9.2: Ultra-Robust Fallback
        if (!link || link.trim() === "") {
            const clean = (s) => s.toString().toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
            const target = clean(folder.name);
            for (const [key, hLink] of Object.entries(HARDCODED_LINKS)) {
                if (clean(key) === target) {
                    link = hLink;
                    break;
                }
            }
        }
        uploadInput.value = link;
    }
    
    document.getElementById('folder-settings-overlay').style.display = 'flex';
}

function closeFolderSettings() {
    document.getElementById('folder-settings-overlay').style.display = 'none';
    state.activeFolderIdForSettings = null;
}

async function saveFolderSettings() {
    const id = state.activeFolderIdForSettings;
    const folder = state.folders.find(f => f.id == id);
    
    if (folder) {
        folder.prefix = document.getElementById('folder-prompt-prefix').value;
        folder.scriptPrefix = document.getElementById('folder-script-prefix').value;
        folder.splitPrefix = document.getElementById('folder-split-prefix').value;
        folder.avatar = tempFolderAvatar; // v2.0: Apply new avatar
        
        const uploadInput = document.getElementById('folder-upload-link');
        if (uploadInput) folder.uploadLink = uploadInput.value;
        
        // Instant UI feedback: close panel first
        closeFolderSettings();
        renderProjects();
        
        logStatus(`🛰️ Сохранение настроек канала "${folder.name}"...`, "info");
        
        try {
            if (cloudDB && authState.isLoggedIn) {
                const { error } = await cloudDB.from('folders')
                    .update({
                        prefix: folder.prefix,
                        scriptPrefix: folder.scriptPrefix,
                        splitPrefix: folder.splitPrefix,
                        avatar: folder.avatar,
                        uploadLink: folder.uploadLink
                    })
                    .eq('id', id);
                if (error) throw error;
                logStatus(`✅ Настройки канала "${folder.name}" сохранены в облаке!`, "success");
            } else {
                saveState(); // Fallback to local
            }
        } catch (e) {
            console.error("Save Folder Settings Error:", e);
            logStatus("❌ Ошибка облака: " + e.message, "error");
        }
    } else {
        console.error("Active folder not found for saving:", id);
        closeFolderSettings();
    }
}

// --- MONETIZATION PROGRESS MODAL ---
let currentMonetizationFolderId = null;

window.openMonetizationModal = function(id) {
    const folder = state.folders.find(f => f.id == id);
    if (!folder) return;
    
    currentMonetizationFolderId = id;
    
    // Set values
    const subs = Number(folder.subscribers) || 0;
    const hours = Number(folder.watchHours) || 0;
    
    const subsValEl = document.getElementById('mon-subs-val');
    const hoursValEl = document.getElementById('mon-hours-val');
    const subsBarEl = document.getElementById('mon-subs-bar');
    const hoursBarEl = document.getElementById('mon-hours-bar');
    const subsInputEl = document.getElementById('mon-subs-input');
    const hoursInputEl = document.getElementById('mon-hours-input');
    const viewsInputEl = document.getElementById('mon-views-input');
    const revInputEl = document.getElementById('mon-rev-input');

    if (subsValEl) subsValEl.innerText = subs.toLocaleString();
    if (hoursValEl) hoursValEl.innerText = hours.toLocaleString();
    
    const subsPercent = Math.min(100, (subs / 1000) * 100);
    const hoursPercent = Math.min(100, (hours / 4000) * 100);
    
    if (subsBarEl) subsBarEl.style.width = subsPercent + '%';
    if (hoursBarEl) hoursBarEl.style.width = hoursPercent + '%';
    
    if (subsInputEl) subsInputEl.value = subs;
    if (hoursInputEl) hoursInputEl.value = hours;
    if (viewsInputEl) viewsInputEl.value = Number(folder.views) || 0;
    if (revInputEl) revInputEl.value = Number(folder.revenue) || 0;
    
    const overlay = document.getElementById('monetization-overlay');
    if (overlay) overlay.style.display = 'flex';
};

window.closeMonetizationModal = function() {
    const overlay = document.getElementById('monetization-overlay');
    if (overlay) overlay.style.display = 'none';
    currentMonetizationFolderId = null;
};

window.saveMonetizationModal = async function() {
    if (!currentMonetizationFolderId) return;
    
    const subsInput = document.getElementById('mon-subs-input').value;
    const hoursInput = document.getElementById('mon-hours-input').value;
    const viewsInput = document.getElementById('mon-views-input') ? document.getElementById('mon-views-input').value : 0;
    const revInput = document.getElementById('mon-rev-input') ? document.getElementById('mon-rev-input').value : 0;
    
    const subs = Number(subsInput);
    const hours = Number(hoursInput);
    const views = Number(viewsInput);
    const rev = Number(revInput);
    
    await updateChannelStats(currentMonetizationFolderId, {
        subscribers: subs,
        watchHours: hours,
        views: views,
        revenue: rev
    });
    
    closeMonetizationModal();
    renderAccountPage();
    renderProjects();
};

// --- PROJECT MANAGEMENT ---
function createNewProject() {
    if (!state.currentFolderId && authState.user.role !== 'owner' && authState.user.role !== 'manager') {
        alert("⚠️ Пожалуйста, сначала войдите в ваш Канал, чтобы создать в нём проект.");
        return;
    }
    const name = prompt("Введите название видео-проекта:", "Новый проект");
    if (!name) return;

    const newProject = {
        id: Date.now(),
        name: name,
        folderId: state.currentFolderId,
        ownedBy: authState.user ? authState.user.login : null,
        scripts: [],
        promptsText: "", 
        results: [],
        assets: [], 
        created: new Date().toLocaleDateString()
    };

    state.projects.unshift(newProject);
    saveState();
    renderProjects();
}

// --- ACCOUNT PAGE ---
function renderAccountPage() {
    if (!authState.isLoggedIn) return;
    const user = authState.user;
    
    const roleColors = { 'owner': '#6366f1', 'partner': '#10b981', 'manager': '#f59e0b' };
    const roleLabels = { 'owner': '👑 ВЛАДЕЛЕЦ', 'partner': '🤝 ПАРТНЁР', 'manager': '📊 МЕНЕДЖЕР' };
    const roleColor = roleColors[user.role] || '#6b7280';
    const roleLabel = roleLabels[user.role] || user.role.toUpperCase();
    const initials = user.login.substring(0, 2).toUpperCase();

    const whitelistEntry = WHITELIST.find(u => u.login === user.login && u.role === user.role);
    const code = whitelistEntry ? whitelistEntry.code : '——';
    const sessionTime = authState.sessionStart ? new Date(authState.sessionStart).toLocaleTimeString() : '—';
    const sessionDate = authState.sessionStart ? new Date(authState.sessionStart).toLocaleDateString() : '—';

    // v1.9.9: Clearer ownership logic
    const isOwner = user.role === 'owner';
    
    // Stats Filtering: "If transferred to another, they are no longer mine, income and views too"
    // So Owners only count UNASSIGNED channels in their grand total.
    // Partners count their ASSIGNED channels.
    const statsFolders = isOwner 
        ? state.folders.filter(f => (f.ownedBy || "").toLowerCase() === user.login.toLowerCase() && (!f.assignedTo || f.assignedTo.trim() === ""))
        : state.folders.filter(f => (f.assignedTo || "").toLowerCase().includes(user.login.toLowerCase()));

    // Dashboard "My Active Projects": Same logic as above
    const myFolders = user.role === 'manager' ? state.folders : statsFolders;

    // Update labels to be explicit about what is being counted
    const viewsLabel = document.getElementById('stats-label-views');
    const subsLabel = document.getElementById('stats-label-subscribers');
    const revLabel = document.getElementById('stats-label-revenue');
    if (viewsLabel) viewsLabel.innerText = isOwner ? 'Личные каналы (без партнёров)' : (user.role === 'manager' ? 'Просмотры по всем каналам' : 'Ваши назначенные каналы');
    if (subsLabel) subsLabel.innerText = isOwner ? 'Личные каналы (без партнёров)' : (user.role === 'manager' ? 'Подписчики по всем каналам' : 'Ваши назначенные каналы');
    if (revLabel) revLabel.innerText = isOwner ? 'Личные каналы (без партнёров)' : (user.role === 'manager' ? 'Доход (Скрыто)' : 'Ваши назначенные каналы');

    const totalProjects = myFolders.reduce((acc, f) =>
        acc + state.projects.filter(p => p.folderId == f.id).length, 0
    );

    // Update greeting name on dashboard
    // Update greeting name on dashboard
    const greetingEl = document.getElementById('greeting-name');
    if (greetingEl) greetingEl.innerText = user.login;
    
    const countEl = document.getElementById('channel-count-display');
    if (countEl) countEl.innerText = myFolders.length;

    // Update main profile avatar/initials
    // Profile Avatar Access
    const avatarContainer = document.getElementById('main-profile-avatar-container');
    if (avatarContainer) {
        if (user.role === 'owner') {
            avatarContainer.onclick = () => openAvatarModal();
            avatarContainer.style.cursor = 'pointer';
            avatarContainer.title = 'Сменить аватар';
        } else {
            avatarContainer.onclick = null;
            avatarContainer.style.cursor = 'default';
            avatarContainer.title = '';
        }
    }

    const mainImg = document.getElementById('main-profile-img');
    const mainInitials = document.getElementById('main-profile-initials');
    if (mainImg && mainInitials) {
        const userAvatar = state.userAvatars[user.login];
        if (userAvatar) {
            mainImg.src = userAvatar;
            mainImg.style.display = 'block';
            mainInitials.style.display = 'none';
        } else {
            mainImg.style.display = 'none';
            mainInitials.style.display = 'flex';
            mainInitials.innerText = user.login.substring(0, 2).toUpperCase();
        }
    }

    // Render channels in the "Мои проекты" dashboard section (HORIZONTAL)
    const profileProjectsPreview = document.getElementById('profile-projects-preview');
    if (profileProjectsPreview) {
        if (myFolders.length === 0) {
            profileProjectsPreview.innerHTML = '<div style="color:var(--text-dim); padding:20px;">Нет каналов</div>';
        } else {
            profileProjectsPreview.innerHTML = myFolders.map(f => {
                const channelColor = f.color || '#6366f1';
                const projCount = state.projects.filter(p => p.folderId == f.id).length;
                const initials = f.name.substring(0, 2).toUpperCase();
                
                return `
                <div class="project-preview-card" style="border-color: ${channelColor};">
                    <div class="card-bg-glow" style="background: radial-gradient(circle at top left, ${channelColor}33, transparent 70%);"></div>
                    <div class="card-content">
                        <div class="card-header">
                            <div class="card-thumb" style="background: linear-gradient(135deg, ${channelColor}88, ${channelColor}); font-size:24px;">
                                ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : initials}
                            </div>
                            <div class="card-info">
                                <h4>${f.name}</h4>
                                <span class="subs">${f.niche || 'Общая ниша'}</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <div class="card-stats">
                                <div style="color: ${channelColor};">Просмотров: ${Number(f.views || 0).toLocaleString()}</div>
                                <div style="color: ${channelColor};">Подписчиков: ${Number(f.subscribers || 0).toLocaleString()}</div>
                                ${user.role !== 'manager' ? (
                                    Number(f.revenue || 0) === 0 ? 
                                    `<div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:6px 10px; cursor:pointer; width:100%;" onclick="event.stopPropagation(); openMonetizationModal(${f.id})">
                                        <div style="font-size:9px; font-weight:800; color:#fca5a5; margin-bottom:4px; text-transform:uppercase; line-height: 1;">До монетизации</div>
                                        <div style="display:flex; gap:4px; width: 100%;">
                                            <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Подписчики: ${f.subscribers||0}/1000"><div style="height:100%; width:${Math.min(100, ((Number(f.subscribers)||0)/1000)*100)}%; background:#f472b6;"></div></div>
                                            <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Часы: ${f.watchHours||0}/4000"><div style="height:100%; width:${Math.min(100, ((Number(f.watchHours)||0)/4000)*100)}%; background:#a5b4fc;"></div></div>
                                        </div>
                                    </div>`
                                    : `<div style="color: #34d399;">Доход: $${Number(f.revenue || 0).toLocaleString()}</div>`
                                ) : '<div style="color: #34d399; opacity: 0.3;">Доход: $***</div>'}
                            </div>
                            <button class="btn-open-project" onclick="openFolder(${f.id}); showPage('videos')" style="background: linear-gradient(90deg, #7f1d1d, ${channelColor});">Открыть →</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // 1. Calculate totals for current user's network
    let totalViews = 0;
    let totalSubscribers = 0;
    let totalRevenue = 0;
    statsFolders.forEach(f => {
        totalViews += Number(f.views) || 0;
        totalSubscribers += Number(f.subscribers) || 0;
        totalRevenue += Number(f.revenue) || 0;
    });

    // Update global dashboard stats
    const dashViews = document.getElementById('dashboard-views');
    const dashSubs = document.getElementById('dashboard-subscribers');
    const dashRev = document.getElementById('dashboard-revenue');
    
    // Test Manager: no income/views totals for self
    const displayViews = user.role === 'manager' ? 0 : totalViews;
    const displaySubs = user.role === 'manager' ? 0 : totalSubscribers;
    const displayRevenue = user.role === 'manager' ? 0 : totalRevenue;

    if (dashViews) {
        if (displayViews >= 1000000) {
            dashViews.innerText = (displayViews / 1000000).toFixed(2) + ' млн';
        } else if (displayViews >= 1000) {
            dashViews.innerText = (displayViews / 1000).toFixed(1) + ' тыс';
        } else {
            dashViews.innerText = displayViews;
        }
    }
    if (dashSubs) {
        if (displaySubs >= 1000000) {
            dashSubs.innerText = (displaySubs / 1000000).toFixed(2) + ' млн';
        } else if (displaySubs >= 1000) {
            dashSubs.innerText = (displaySubs / 1000).toFixed(1) + ' тыс';
        } else {
            dashSubs.innerText = displaySubs;
        }
    }
    if (dashRev) {
        dashRev.innerText = '$' + displayRevenue.toLocaleString('en-US');
    }

    const folderCards = myFolders.map(f => {
        const projCount = state.projects.filter(p => p.folderId == f.id).length;
        const channelColor = f.color || 'var(--accent-primary)';
        return `
                <div class="project-card folder-card" onclick="exitFolder(); openFolder(${f.id}); showPage('videos');" style="cursor:pointer; position:relative; border-color: ${channelColor}44; padding: 24px; border-radius: 24px;">
                    <button class="btn-folder-settings" onclick="event.stopPropagation(); openFolderSettings(${f.id})" title="Настройки промптов">⚙️</button>
                    
                    <div style="width:64px; height:64px; border-radius:18px; overflow:hidden; margin-bottom:12px; border:2px solid ${channelColor}44;">
                        ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:${channelColor}11; display:flex; align-items:center; justify-content:center; font-size:24px;">📺</div>`}
                    </div>
                    
                    <div class="project-name" style="font-size:18px; font-weight:800;">${f.name}</div>
                    <div style="font-size:10px; font-weight:800; color:${channelColor}; text-transform:uppercase; letter-spacing:1px; margin-top:-4px; margin-bottom:8px;">${f.niche || 'Общая ниша'}</div>
                    <div class="project-meta">${projCount} проектов • ${f.created || ''}</div>
                    <div style="margin-top: 12px; font-size: 10px; font-weight: 800; color: ${channelColor}; letter-spacing: 1.5px; text-transform:uppercase;">Открыть студию →</div>
                </div>
            `;
    }).join('');

    const container = document.getElementById('account-page-content');
    if (!container) return;

    container.innerHTML = `
        <div style="margin-top: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <h3 class="section-title" style="font-size: 20px; margin:0;">Управление аккаунтом</h3>
            <button onclick="clearLocalCache()" style="
                display: flex; align-items: center; gap: 8px;
                background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05));
                border: 1px solid rgba(239,68,68,0.35);
                color: #ef4444; border-radius: 14px; padding: 10px 20px;
                font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;
                transition: all 0.2s;" 
                onmouseenter="this.style.background='rgba(239,68,68,0.22)'; this.style.borderColor='#ef4444';"
                onmouseleave="this.style.background='linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05))'; this.style.borderColor='rgba(239,68,68,0.35)';"
                title="Очищает кэш браузера (localStorage). Облачные данные не затрагиваются.">
                🗑️ Очистить кэш браузера
            </button>
        </div>
        <!-- PARTNER MANAGEMENT (Owner & Manager) -->
        ${(user.role === 'owner' || user.role === 'manager') ? `
        <div style="margin-top:64px; padding-top:48px; border-top:1px solid var(--border-glass);">
            <div style="margin-bottom:32px;">
                <h3 style="margin:0; font-size:20px; font-weight:800; letter-spacing:1px;">👥 УПРАВЛЕНИЕ ПАРТНЁРАМИ</h3>
                <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">Назначьте каналы вашим сотрудникам для ведения.</p>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap:32px;">
                ${WHITELIST.map(u => {
                    const assigned = state.folders.filter(f => {
                        const users = (f.assignedTo || "").split(',').map(s => s.trim()).filter(Boolean);
                        const ownerLogin = (f.ownedBy || "").toLowerCase();
                        const currentLogin = u.login.toLowerCase();
                        
                        // For Owner's card in this list: show only what is NOT yet assigned to anyone
                        if (u.role === 'owner') return ownerLogin === currentLogin && users.length === 0;
                        // For Partner's card: show what they are working on
                        return users.some(user => user.toLowerCase() === currentLogin);
                    });
                    const userAvatar = state.userAvatars[u.login];
                    return `
                        <div class="glass-panel" style="padding:32px; border-radius:32px; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.05); transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s;" onmouseenter="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px rgba(0,0,0,0.3)';" onmouseleave="this.style.transform='none'; this.style.boxShadow='none';">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px;">
                                <div style="display:flex; align-items:center; gap:16px;">
                                    <div style="width:56px; height:56px; border-radius:20px; overflow:hidden; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:20px; box-shadow: 0 10px 20px rgba(99,102,241,0.2);">
                                        ${userAvatar ? `<img src="${userAvatar}" style="width:100%; height:100%; object-fit:cover;">` : u.login[0]}
                                    </div>
                                    <div>
                                        <div style="font-weight:900; font-size:18px; letter-spacing:-0.5px;">${u.login}</div>
                                        <div style="font-size:10px; color:var(--accent-primary); font-weight:800; text-transform:uppercase; letter-spacing:1.5px;">${u.role}</div>
                                    </div>
                                </div>
                                <button class="btn-avatar-edit" onclick="openAvatarModal('${u.login}')" style="width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); color:white; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" title="Изменить аватар сотрудника" onmouseenter="this.style.background='white'; this.style.color='black'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'; this.style.color='white'">👤</button>
                            </div>
                            
                            <div style="background:rgba(0,0,0,0.3); border-radius:24px; padding:20px; border:1px solid rgba(255,255,255,0.03);">
                                <div style="font-size:11px; font-weight:900; color:var(--text-dim); text-transform:uppercase; margin-bottom:16px; letter-spacing:1.5px; opacity:0.6;">АКТИВНЫЕ КАНАЛЫ:</div>
                                <div style="display:flex; flex-direction:column; gap:12px;">
                                    ${assigned.length > 0 ? assigned.map(f => `
                                            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.05); gap: 10px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;">
                                                <div onclick="enterChannel(${f.id})" style="display:flex; align-items:center; gap:12px; flex: 1; cursor: pointer;" title="Войти в управление каналом" onmouseenter="this.parentElement.style.background='rgba(255,255,255,0.06)'; this.parentElement.style.borderColor='var(--accent-primary)';" onmouseleave="this.parentElement.style.background='rgba(255,255,255,0.02)'; this.parentElement.style.borderColor='rgba(255,255,255,0.05)';">
                                                    <div style="width:28px; height:28px; border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                                                        ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:12px; display:flex; align-items:center; justify-content:center; height:100%;">📺</span>'}
                                                    </div>
                                                    <span style="font-size:14px; font-weight:700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${f.name}</span>
                                                </div>
                                                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                                    <div title="Просмотры (задаются в Supabase)" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:3px 8px; font-size:11px; font-weight:700; color:#a5b4fc; white-space:nowrap; ${user.role==='owner'?'cursor:pointer;':''}" ${user.role==='owner'?`onclick="event.stopPropagation(); let v=prompt('Просмотры:', '${f.views||0}'); if(v!==null) updateChannelStats(${f.id}, 'views', v)"`:''}>👁 ${(Number(f.views)||0).toLocaleString()}</div>
                                                    <div title="Подписчики (задаются в Supabase)" style="background:rgba(236,72,153,0.15); border:1px solid rgba(236,72,153,0.3); border-radius:8px; padding:3px 8px; font-size:11px; font-weight:700; color:#f472b6; white-space:nowrap; ${user.role==='owner'?'cursor:pointer;':''}" ${user.role==='owner'?`onclick="event.stopPropagation(); let v=prompt('Подписчики:', '${f.subscribers||0}'); if(v!==null) updateChannelStats(${f.id}, 'subscribers', v)"`:''}>👥 ${(Number(f.subscribers)||0).toLocaleString()}</div>
                                                    ${user.role !== 'manager' ? (
                                                        Number(f.revenue || 0) === 0 ?
                                                        `<div title="До монетизации" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:4px 8px; cursor:pointer;" onclick="event.stopPropagation(); openMonetizationModal(${f.id})">
                                                            <div style="font-size:9px; font-weight:800; color:#fca5a5; margin-bottom:4px; text-transform:uppercase; line-height: 1;">До монетизации</div>
                                                            <div style="display:flex; gap:4px; width: 60px;">
                                                                <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Подписчики: ${f.subscribers||0}/1000"><div style="height:100%; width:${Math.min(100, ((Number(f.subscribers)||0)/1000)*100)}%; background:#f472b6;"></div></div>
                                                                <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Часы: ${f.watchHours||0}/4000"><div style="height:100%; width:${Math.min(100, ((Number(f.watchHours)||0)/4000)*100)}%; background:#a5b4fc;"></div></div>
                                                            </div>
                                                        </div>`
                                                        :
                                                        `<div title="Доход (задаётся в Supabase)" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:3px 8px; font-size:11px; font-weight:700; color:#6ee7b7; white-space:nowrap; ${user.role==='owner'?'cursor:pointer;':''}" ${user.role==='owner'?`onclick="event.stopPropagation(); openMonetizationModal(${f.id})"`:''}>$${(Number(f.revenue)||0).toLocaleString()}</div>`
                                                    ) : ''}
                                                    ${user.role === 'owner' ? `<button class="btn-del-mini" onclick="event.stopPropagation(); unassignFolder(${f.id}, '${u.login}')" title="Отвязать канал" style="opacity:0.4; transition:opacity 0.2s; font-size: 18px; line-height: 1;" onmouseenter="this.style.opacity='1'; this.style.color='#ef4444'" onmouseleave="this.style.opacity='0.4'; this.style.color='white'">×</button>` : ''}
                                                </div>
                                            </div>
                                    `).join('') : '<div style="color:var(--text-dim); font-size:13px; font-style:italic; padding:10px; text-align:center;">Нет назначенных каналов</div>'}
                                </div>
                            </div>

                            <div style="margin-top:24px;">
                                ${user.role === 'owner' ? `
                                <select onchange="assignFolderToUser(this.value, '${u.login}')" style="width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:14px; color:white; font-size:12px; font-weight:700; outline:none; cursor:pointer; transition:all 0.2s; appearance:none;" onfocus="this.style.borderColor='var(--accent-primary)'; this.style.background='rgba(255,255,255,0.05)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.03)';">
                                    <option value="" style="background:#0a0a0c;">+ ПРИВЯЗАТЬ НОВЫЙ КАНАЛ...</option>
                                    ${state.folders.filter(f => f.ownedBy === authState.user.login).map(f => `
                                        <option value="${f.id}">${f.name} ${f.assignedTo ? '(Уже назначен)' : ''}</option>
                                    `).join('')}
                                </select>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
    `;
}

// --- ASSIGNMENT LOGIC ---
// --- STATS REFRESH ---
window.refreshCloudStats = async function(btn) {
    if (btn) btn.classList.add('spinning');
    try {
        await loadState();
        logStatus("📊 Статистика обновлена!", "success");
    } catch (e) {
        console.error("Manual refresh failed:", e);
        logStatus("❌ Ошибка обновления", "error");
    } finally {
        if (btn) btn.classList.remove('spinning');
    }
};

window.updateChannelStats = async function(folderId, fieldOrData, value) {
    const folder = state.folders.find(f => String(f.id) === String(folderId));
    if (!folder) return;

    let updateData = {};
    if (typeof fieldOrData === 'object') {
        updateData = fieldOrData;
        Object.assign(folder, updateData);
    } else {
        const field = fieldOrData;
        const numericValue = (field === 'views' || field === 'revenue' || field === 'subscribers' || field === 'watchHours') ? Number(value) : value;
        folder[field] = numericValue;
        updateData[field] = numericValue;
        
        // v4.6: Data Protection - mark as locally modified to prevent immediate overwrite by old cloud data
        folder._lastChangeAt = Date.now();
    }
    
    // Immediate UI Feedback (Stats reflect before DB response)
    if (state.activePage === 'account') {
        const dashViews = document.getElementById('dashboard-views');
        const dashRev = document.getElementById('dashboard-revenue');
        
        // Recalculate totals for immediate display
        const isOwner = authState.user.role === 'owner';
        const statsFolders = isOwner 
            ? state.folders.filter(f => (f.ownedBy || "").toLowerCase() === authState.user.login.toLowerCase() && (!f.assignedTo || f.assignedTo.trim() === ""))
            : state.folders.filter(f => (f.assignedTo || "").toLowerCase().includes(authState.user.login.toLowerCase()));
        
        let totalViews = 0, totalSubscribers = 0, totalRevenue = 0;
        statsFolders.forEach(f => {
            totalViews += Number(f.views) || 0;
            totalSubscribers += Number(f.subscribers) || 0;
            totalRevenue += Number(f.revenue) || 0;
        });

        const dashSubs = document.getElementById('dashboard-subscribers');
        if (dashViews) dashViews.innerText = totalViews.toLocaleString();
        if (dashSubs) dashSubs.innerText = totalSubscribers.toLocaleString();
        if (dashRev) dashRev.innerText = '$' + totalRevenue.toLocaleString();
    }

    logStatus(`⏳ Синхронизация статистики...`, "info");
    
    try { localStorage.setItem('animtube_folders', JSON.stringify(state.folders)); } catch(e) { console.warn('⚠️ localStorage full, skipping local cache:', e.message); }

    if (cloudDB && authState.isLoggedIn) {
        try {
            // Normalize keys for individual update
            const finalData = {};
            for (let k in updateData) {
                const normalizedKey = k.toLowerCase();
                finalData[normalizedKey] = updateData[k];
            }

            const { error } = await cloudDB.from('folders')
                .update(finalData)
                .eq('id', folderId);
                
            if (error) throw error;
            logStatus(`✅ Данные сохранены.`, "success");
        } catch (err) {
            console.error("❌ Cloud Sync Error:", err);
            logStatus("🔴 Ошибка сохранения: " + (err.message || "Ошибка соединения"), "error");
        }
    }
}

async function assignFolderToUser(folderId, userLogin) {
    if (!folderId) return;
    const folder = state.folders.find(f => f.id == folderId);
    if (!folder) return;

    logStatus(`⏳ Привязка канала к ${userLogin}...`, "info");
    
    // Manage assignedTo as a comma-separated list
    let userList = (folder.assignedTo || "").split(',').map(s => s.trim()).filter(Boolean);
    if (!userList.includes(userLogin)) {
        userList.push(userLogin);
    }
    const newAssigned = userList.join(',');
    folder.assignedTo = newAssigned;

    if (cloudDB && authState.isLoggedIn) {
        try {
            const { error } = await cloudDB.from('folders')
                .update({ assignedto: newAssigned })
                .eq('id', folderId);
            
            if (error) throw error;
            logStatus(`✅ Доступ предоставлен ${userLogin}.`, "success");
        } catch (err) {
            console.error("❌ Assignment Error:", err);
            logStatus("❌ Ошибка привязки: " + err.message, "error");
        }
    }
    renderAccountPage();
}

window.unassignFolder = async function(folderId, userLogin) {
    const folder = state.folders.find(f => f.id == folderId);
    if (!folder) return;

    logStatus(`⏳ Отвязка канала от ${userLogin}...`, "info");

    let userList = (folder.assignedTo || "").split(',').map(s => s.trim()).filter(Boolean);
    const newList = userList.filter(u => u !== userLogin);
    const newAssigned = newList.join(',') || null;
    folder.assignedTo = newAssigned;

    if (cloudDB && authState.isLoggedIn) {
        try {
            const { error } = await cloudDB.from('folders')
                .update({ assignedto: newAssigned })
                .eq('id', folderId);
            
            if (error) throw error;
            logStatus(`✅ Канал отвязан от ${userLogin}.`, "success");
            
            // Premium Feedback: Return to owner's pool animation
            flashTitleNotification("🛰️ КАНАЛ ВОЗВРАЩЕН");
        } catch (err) {
            console.error("❌ Unassign Error:", err);
            logStatus("❌ Ошибка отвязки: " + err.message, "error");
        }
    }
    renderAccountPage();
}

window.assignFolderToUser = assignFolderToUser;
window.unassignFolder = unassignFolder;

function createNewFolderForAccount() {
    createNewFolder();
    // Re-render account page after folder creation
    setTimeout(() => {
        if (state.activePage === 'account') renderAccountPage();
    }, 100);
}

function renderProjects() {
    const container = document.getElementById('project-list-container');
    const description = document.getElementById('projects-view-description');
    const headerActions = document.getElementById('channel-header-actions');
    if (!container) return;
    
    // Safety check: if not logged in, don't try to render user-specific data
    if (!authState.isLoggedIn || !authState.user) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-dim);">Пожалуйста, войдите в систему.</div>`;
        return;
    }

    container.innerHTML = "";
    if (headerActions) headerActions.innerHTML = "";

    // 1. Handle Navigation Header (Breadcrumbs)
    if (state.currentFolderId) {
        const folder = state.folders.find(f => f.id == state.currentFolderId);
        const folderName = folder ? folder.name : "Канал";
        
        if (description) description.innerHTML = `<span style="color:var(--accent-primary); cursor:pointer;" onclick="exitFolder()">Мои Каналы</span> / <b>${folderName}</b>`;
        
        if (headerActions && folder) {
            headerActions.innerHTML = `
                <button class="btn-folder-settings" onclick="openFolderSettings(${folder.id})" style="position:static; width:45px; height:45px; font-size:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; cursor:pointer;" title="Настройки канала">⚙️</button>
            `;
        }
        
        // Add professional Back button
        const backBtn = document.createElement('div');
        backBtn.className = "project-card folder-card";
        backBtn.style.width = "60px";
        backBtn.style.height = "60px";
        backBtn.style.display = "flex";
        backBtn.style.alignItems = "center";
        backBtn.style.justifyContent = "center";
        backBtn.style.background = "rgba(255, 255, 255, 0.05)";
        backBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        backBtn.style.borderRadius = "12px";
        backBtn.style.cursor = "pointer";
        backBtn.onclick = exitFolder;
        backBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        `;
        container.appendChild(backBtn);

        // Add "Create Project" button
        const addBtn = document.createElement('div');
        addBtn.className = "project-card folder-card btn-add-project";
        addBtn.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))";
        addBtn.style.border = "1px dashed #10b981";
        addBtn.onclick = createNewProject;
        addBtn.innerHTML = `
            <div class="project-name" style="font-weight:700; color:#10b981;">+ СОЗДАТЬ ПРОЕКТ</div>
        `;
        container.appendChild(addBtn);
    } else {
        if (description) description.innerText = "Управляйте своими анимационными каналами и проектами.";
    }

    // 2. Render Folders (only at root)
    if (!state.currentFolderId) {
        let visibleFolders = authState.user.role === 'owner' 
            ? state.folders.filter(f => (f.ownedBy || "").toLowerCase() === authState.user.login.toLowerCase() && (!f.assignedTo || f.assignedTo.trim() === "")) 
            : (authState.user.role === 'manager' ? state.folders : state.folders.filter(f => (f.assignedTo || "").toLowerCase().includes(authState.user.login.toLowerCase())));

        // No longer filtering by avatar to prevent data loss
        // visibleFolders = visibleFolders.filter(f => f.avatar);

        visibleFolders.forEach(f => {
            const projectCount = state.projects.filter(p => p.folderId == f.id).length;
            const channelColor = f.color || 'var(--accent-primary)';
            const card = document.createElement('div');
            card.className = "featured-channel-card";
            card.style.borderColor = channelColor;
            card.style.marginBottom = "30px";
            card.onclick = () => openFolder(f.id);
            
            // Find who is leading this channel
            const leading = f.assignedTo || f.ownedBy || '—';
            
            card.innerHTML = `
                <div class="channel-main-info" style="display:flex; align-items:center; gap:30px;">
                    <div style="width:120px; height:120px; border-radius:24px; overflow:hidden; border:3px solid ${channelColor}; flex-shrink:0; box-shadow: 0 10px 20px ${channelColor}22;">
                        ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:${channelColor}22; display:flex; align-items:center; justify-content:center; font-size:40px;">📺</div>`}
                    </div>
                    <div style="flex:1;">
                        <div class="folder-badge" style="background:${channelColor}; margin-bottom:8px; width:fit-content; position:static;">АКТИВНЫЙ КАНАЛ</div>
                        <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 2px;">${f.name}</h2>
                        <div style="color:${channelColor}; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; font-size:11px; margin-bottom:10px;">${f.niche || 'Общая ниша'}</div>
                        <div style="display:flex; align-items:center; gap:15px; margin-bottom:5px;">
                             <div title="Просмотры" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); border-radius:8px; padding:4px 10px; font-size:12px; font-weight:800; color:#a5b4fc; ${authState.user.role==='owner'?'cursor:pointer;':''}" ${authState.user.role==='owner'?`onclick="event.stopPropagation(); openMonetizationModal(${f.id})"`:''}>👁 ${(Number(f.views)||0).toLocaleString()}</div>
                             <div title="Подписчики" style="background:rgba(236,72,153,0.1); border:1px solid rgba(236,72,153,0.2); border-radius:8px; padding:4px 10px; font-size:12px; font-weight:800; color:#f472b6; ${authState.user.role==='owner'?'cursor:pointer;':''}" ${authState.user.role==='owner'?`onclick="event.stopPropagation(); openMonetizationModal(${f.id})"`:''}>👥 ${(Number(f.subscribers)||0).toLocaleString()}</div>
                             ${authState.user.role !== 'manager' ? (
                                 Number(f.revenue || 0) === 0 ?
                                 `<div title="До монетизации" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:4px 8px; cursor:pointer;" onclick="event.stopPropagation(); openMonetizationModal(${f.id})">
                                     <div style="font-size:9px; font-weight:800; color:#fca5a5; margin-bottom:4px; text-transform:uppercase; line-height: 1;">До монетизации</div>
                                     <div style="display:flex; gap:4px; width: 60px;">
                                         <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Подписчики: ${f.subscribers||0}/1000"><div style="height:100%; width:${Math.min(100, ((Number(f.subscribers)||0)/1000)*100)}%; background:#f472b6;"></div></div>
                                         <div style="height:4px; flex:1; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;" title="Часы: ${f.watchHours||0}/4000"><div style="height:100%; width:${Math.min(100, ((Number(f.watchHours)||0)/4000)*100)}%; background:#a5b4fc;"></div></div>
                                     </div>
                                 </div>`
                                 :
                                 `<div title="Доход" style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:4px 10px; font-size:12px; font-weight:800; color:#6ee7b7; ${authState.user.role==='owner'?'cursor:pointer;':''}" ${authState.user.role==='owner'?`onclick="event.stopPropagation(); openMonetizationModal(${f.id})"`:''}>$${(Number(f.revenue)||0).toLocaleString()}</div>`
                             ) : ''}
                        </div>
                        <p style="color: var(--text-secondary); font-size: 13px;">${projectCount} активных проектов • Ведущий: ${leading}</p>
                    </div>
                </div>
                <div class="channel-actions" style="display:flex; align-items:center; gap:15px;">
                     <button class="btn btn-primary" style="background:${channelColor}; padding: 12px 30px; font-size: 14px; box-shadow: 0 10px 20px ${channelColor}33;">ОТКРЫТЬ СТУДИЮ →</button>
                     <button class="btn-folder-settings" onclick="event.stopPropagation(); openFolderSettings(${f.id})" style="position:static; width:45px; height:45px; font-size:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; cursor:pointer;">⚙️</button>
                     ${authState.user.role === 'owner' ? `<button class="btn-del-mini" onclick="event.stopPropagation(); deleteFolder(${f.id})" style="width:45px; height:45px; font-size:20px; border-radius:12px; background:rgba(239,68,68,0.1); color:#ef4444; border:none; cursor:pointer;">×</button>` : ''}
                </div>
            `;
            container.appendChild(card);
        });

        // Add square "Create Channel" button at the end (Owner & Manager)
        if (authState.user.role === 'owner' || authState.user.role === 'manager') {
            const addCard = document.createElement('div');
            addCard.className = "featured-channel-card role-owner-only role-manager-only";
            addCard.style.width = "100px";
            addCard.style.height = "100px";
            addCard.style.display = "flex";
            addCard.style.alignItems = "center";
            addCard.style.justifyContent = "center";
            addCard.style.border = "2px dashed #ef4444";
            addCard.style.background = "rgba(239, 68, 68, 0.05)";
            addCard.style.cursor = "pointer";
            addCard.style.borderRadius = "20px";
            addCard.onclick = createNewFolder;
            addCard.title = "Создать новый канал";
            addCard.innerHTML = `<div style="display: grid; place-items: center; width: 100%; height: 100%; font-size: 30px; color: #ef4444;">+</div>`;
            container.appendChild(addCard);
        }
    }

    // 3. Render Projects (filtered by current folder)
    const filteredProjects = state.projects.filter(p => p.folderId == state.currentFolderId);
    console.log(`🎨 [RENDER] Rendering ${filteredProjects.length} projects for folder ${state.currentFolderId}`);
    
    // Non-owners can't see root projects if they are not in a folder
    if (!state.currentFolderId && authState.user.role !== 'owner') {
        if (container.children.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-dim);">У вас пока нет назначенных каналов.</div>`;
        }
        return;
    }
    
    if (filteredProjects.length === 0 && !state.currentFolderId && state.folders.length === 0) {
        container.innerHTML = `
            <div class="project-card btn-add-project" onclick="createNewProject()" style="grid-column: 1/-1; height: 180px;">
                <div class="brand">
                    <span style="font-size: 24px;">📺</span>
                    <h1>ANIMTUBE<br><small style="font-size: 10px; color: var(--accent-primary); letter-spacing: 2px;">V1.1 STUDIO</small></h1>
                </div>
                <p>Нажмите, чтобы создать первый проект или папку</p>
            </div>
        `;
        return;
    }

    filteredProjects.forEach(p => {
        const card = document.createElement('div');
        // v1.5.5: Inclusive script detection (checks if ANY script entry exists)
        const hasScriptInside = p.scripts && p.scripts.length > 0;
        if (hasScriptInside && (!p.status || p.status < 1)) {
            p.status = 1;
        }

        // v1.8.2: Ensure status is treated as a number for comparison
        const status = Number(p.status || 0); 
        
        let statusClass = "status-red";
        if (status === 1) statusClass = "status-yellow";
        else if (status === 2) statusClass = "status-green";

        card.className = `project-card ${statusClass}`;
        card.onclick = () => openProject(p.id);
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 20px; width: 100%; padding: 5px 10px;">
                <div style="flex: 1;">
                    <div class="project-name" style="margin-top:0; font-size: 16px; font-weight: 800; letter-spacing: -0.3px;">${p.name}</div>
                    <div class="project-meta" style="margin-top: 4px; font-size: 12px; opacity: 0.6;">${p.results ? p.results.length : 0} кадров • ${p.created}</div>
                </div>
                <div class="project-status-checks" style="display: flex; gap: 10px; flex-shrink: 0; margin-left: auto; align-items: center;" onclick="event.stopPropagation()">
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; margin-right: 5px;">
                         <span style="font-size: 9px; font-weight: 900; color: #f59e0b; opacity: ${status >= 1 ? '1' : '0.3'};">SCRIPT</span>
                         <span style="font-size: 9px; font-weight: 900; color: #10b981; opacity: ${status >= 2 ? '1' : '0.3'};">VIDEO</span>
                    </div>
                    <input type="checkbox" ${status >= 1 ? 'checked' : ''} onchange="toggleProjectStatus(${p.id}, 1)" style="width: 22px; height: 22px; cursor: pointer; accent-color: #f59e0b;" title="Сценарий готов">
                    <input type="checkbox" ${status >= 2 ? 'checked' : ''} onchange="toggleProjectStatus(${p.id}, 2)" style="width: 22px; height: 22px; cursor: pointer; accent-color: #10b981;" title="Ролик выгружен">
                </div>
                <button class="lib-del-btn" style="position: static; margin-left: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px;" onclick="event.stopPropagation(); deleteProject(${p.id})">×</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.toggleProjectStatus = async (projectId, step) => {
    const project = state.projects.find(p => p.id == projectId);
    if (!project) return;

    // Use querySelector for reliable lookup by ID
    const checkboxes = document.querySelectorAll(`[onchange="toggleProjectStatus(${projectId}, 1)"], [onchange="toggleProjectStatus(${projectId}, 2)"]`);
    const check1 = checkboxes[0]?.checked;
    const check2 = checkboxes[1]?.checked;

    let newStatus = 0;
    if (check2) newStatus = 2; // Green
    else if (check1) newStatus = 1; // Orange
    else newStatus = 0; // Red

    project.status = newStatus;
    
    // Explicitly update data JSON as backup for some DB configurations
    if (!project.data) project.data = {};
    project.data.status = newStatus;

    renderProjects();
    logStatus(`🛰️ Синхронизация статуса проекта: ${newStatus}`, "info");
    
    try {
        await saveState();
        logStatus(`✅ Статус "${project.name}" успешно сохранен!`, "success");
    } catch (e) {
        console.error("Status Sync Failed:", e);
        logStatus(`❌ Ошибка сохранения: ${e.message}`, "error");
    }
};

async function deleteFolder(id) {
    if (authState.user.role !== 'owner' && authState.user.role !== 'manager') {
        alert("🚫 Удалять каналы может только Владелец или Менеджер.");
        return;
    }
    // Use == for flexible ID comparison
    const folder = state.folders.find(f => f.id == id);
    if (!folder) return;
    if (!confirm(`Удалить канал "${folder.name}" НАВСЕГДА? Проекты внутри также будут удалены.`)) return;

    logStatus(`🗑️ Удаление канала...`, "info");
    
    // 1. Local cleanup FIRST (for speed)
    state.folders = state.folders.filter(f => f.id != id);
    state.projects = state.projects.filter(p => p.folderId != id);
    
    renderAccountPage();

    // 2. Cloud cleanup in background
    if (cloudDB && authState.isLoggedIn) {
        try {
            await cloudDB.from('folders').delete().eq('id', id);
            await cloudDB.from('projects').delete().eq('folderid', id);
        } catch (e) {
            console.warn("Cloud delete background error:", e);
        }
    }

    saveState();
    logStatus(`✅ Канал "${folder.name}" удален.`, "success");
}

async function deleteProject(id) {
    // Use == for flexible ID comparison
    const project = state.projects.find(p => p.id == id);
    if (!project) {
        console.warn("Project not found for deletion:", id);
        return;
    }
    
    if (!confirm(`Удалить проект "${project.name}"?`)) return;

    logStatus(`🗑️ Удаление проекта...`, "info");

    // 1. Local cleanup FIRST (Instant UI feedback)
    state.projects = state.projects.filter(p => p.id != id);
    
    if (state.activeProjectId == id) {
        state.activeProjectId = null;
        showPage('account');
    }
    
    renderProjects();
    if (state.activePage === 'account') renderAccountPage();

    // 2. Cloud cleanup in background (don't block UI)
    if (cloudDB && authState.isLoggedIn) {
        try {
            if (project.results && project.results.length > 0) {
                const imageIds = project.results.map(r => r.id);
                await cloudDB.from('project_images').delete().in('id', imageIds);
            }
            await cloudDB.from('projects').delete().eq('id', id);
        } catch (e) {
            console.error("❌ Cloud delete failed:", e);
            logStatus("⚠️ Ошибка облака, но проект удален локально", "error");
        }
    }

    saveState();
    logStatus(`✅ Проект "${project.name}" удален.`, "success");
}


function requestMoveProject(projectId) {
    const options = state.folders.map(f => `${f.id}: ${f.name}`).join('\n');
    const input = prompt("Введите ID папки для перемещения (оставьте пустым для корня):\n\n" + options);
    
    if (input === null) return;
    
    const targetFolderId = input.trim() === "" ? null : parseInt(input);
    moveProjectToFolder(projectId, targetFolderId);
}

function moveProjectToFolder(projectId, folderId) {
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
        project.folderId = folderId;
        saveState();
        renderProjects();
        logStatus(`✅ Проект "${project.name}" перемещен.`, "success");
    }
}



function openProject(id) {
    const project = state.projects.find(p => p.id == id);
    if (!project) return;

    state.activeProjectId = id;
    state.currentFolderId = project.folderId; // CRITICAL: set folder context for assets sync
    const nameEl = document.getElementById('current-project-name');
    if (nameEl) nameEl.innerText = project.name;

    // v1.5.7: Update Upload Link Button
    const uploadBtn = document.getElementById('btn-upload-video');
    if (uploadBtn) {
        const folder = getFolderForProject(id);
        
        // Final fallback just in case getFolderForProject didn't catch it
        let link = (folder && folder.uploadLink) ? folder.uploadLink : null;
        if (folder && (!link || link.trim() === "")) {
             const clean = (s) => s.toString().toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
             const target = clean(folder.name);
             for (const [key, hLink] of Object.entries(HARDCODED_LINKS)) {
                 if (clean(key) === target) { link = hLink; break; }
             }
        }

        if (link) {
            uploadBtn.onclick = () => window.open(link, '_blank');
            uploadBtn.style.opacity = '1';
            uploadBtn.title = "Перейти к выгрузке";
        } else {
            uploadBtn.onclick = () => alert("⚠️ Ссылка для загрузки не настроена в настройках канала (шестерёнка).");
            uploadBtn.style.opacity = '0.5';
            uploadBtn.title = "Ссылка не настроена";
        }
    }
    
    // Migration: ensure project has script fields if it's old
    if (!project.scripts) project.scripts = [];
    
    // 1-to-1 SYNC MIGRATION (v1.3.7)
    if (project.promptsList && project.promptsList.length > 0) {
        let needsMigration = project.promptsList.some(p => typeof p === 'string');
        
        if (needsMigration) {
            console.log("🛠️ Migrating Prompts List to 1-to-1 Sync objects...");
            
            const folder = getFolderForProject(id);
            const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
            
            project.promptsList = project.promptsList.map(item => {
                if (typeof item !== 'string') return item; // Already an object
                
                const text = item;
                const fullPrompt = text.includes(prefix) ? text : (prefix.trim() + "\n\n" + text.trim()).trim();
                const matchingResult = project.results ? project.results.find(r => r.promptSnippet === fullPrompt) : null;
                
                return {
                    text: text,
                    isGeminiDone: !!matchingResult,
                    isGrokDone: matchingResult ? (matchingResult.isGrokDone || false) : false,
                    resultId: matchingResult ? matchingResult.id : null
                };
            });
            saveState();
        }
    }
    
    // Cleanup obsolete field from previous attempt
    if (project.animationQueue) delete project.animationQueue;

    // Default to "Script" tab on open (v12.0)
    // We wait a tiny bit to ensure DOM is ready for tab switching
    setTimeout(() => {
        switchProjectTab('script');
        renderProjectScripts();
        renderProjectLibrary();
        renderProjectAssets();
        renderProjectPrompts();
        renderQueue();
    }, 10);
    
    showPage('workspace');
}

function deleteCurrentProject() {
    if (!confirm("Вы уверены, что хотите удалить эту видео-папку? Все кадры будут стерты.")) return;
    
    const project = getCurrentProject();
    if (project) {
        project.results.forEach(res => {
            const transaction = db.transaction(["images"], "readwrite");
            transaction.objectStore("images").delete(res.id);
        });
    }

    state.projects = state.projects.filter(p => p.id !== state.activeProjectId);
    state.activeProjectId = null;
    saveState();
    showPage('videos');
}

async function base64ToBlob(base64) {
    const res = await fetch(base64);
    return await res.blob();
}

async function downloadProjectFiles() {
    const project = getCurrentProject();
    if (!project) return alert("Проект не найден!");
    if ((!project.results || project.results.length === 0) && (!project.scripts || project.scripts.length === 0)) {
        return alert("Нет файлов (кадров или сценариев) для скачивания!");
    }

    try {
        // 1. Request directory
        const dirHandle = await window.showDirectoryPicker();
        logStatus("📁 Папка выбрана. Начинаю сохранение...", "info");

        // 2. Save Frames
        if (project.results && project.results.length > 0) {
            logStatus(`🖼️ Сохраняю кадры (${project.results.length})...`, "info");
            for (let i = 0; i < project.results.length; i++) {
                try {
                    const res = project.results[project.results.length - 1 - i]; 
                    const base64 = await getImageFromDB(res.id);
                    if (base64) {
                        const blob = await base64ToBlob(base64);
                        const fileName = `frame_${project.id}_${i+1}.png`;
                        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    }
                } catch (e) {
                    console.warn(`Frame ${i} save failed:`, e);
                }
            }
        }

        // 3. Save Scripts/Scenarios
        if (project.scripts && project.scripts.length > 0) {
            logStatus(`📝 Сохраняю сценарии (${project.scripts.length})...`, "info");
            for (let i = 0; i < project.scripts.length; i++) {
                try {
                    const s = project.scripts[i];
                    const fileName = `Scenario_${project.name}_${s.scriptNum || (project.scripts.length - i)}.txt`;
                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(s.text);
                    await writable.close();
                } catch (e) {
                    console.warn(`Script ${i} save failed:`, e);
                }
            }
        }

        // 4. Save Animations (v1.4)
        if (project.promptsList && project.promptsList.length > 0) {
            logStatus("🎬 Проверка наличия анимаций...", "info");
            let animCount = 0;
            for (let i = 0; i < project.promptsList.length; i++) {
                try {
                    const item = project.promptsList[i];
                    if (item.isGrokDone && item.resultId) {
                        const animBase64 = await getAnimationFromDB(item.resultId);
                        if (animBase64) {
                            const blob = await base64ToBlob(animBase64);
                            const fileName = `animation_${project.id}_frame_${i+1}.mp4`;
                            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                            animCount++;
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to save animation ${i}:`, err);
                }
            }
            if (animCount > 0) logStatus(`✅ Сохранено ${animCount} анимаций!`, "success");
        }

        logStatus("✅ Все файлы успешно сохранены в выбранную папку!", "success");
    } catch (err) {
        if (err.name === 'AbortError') {
            logStatus("⚠️ Сохранение отменено пользователем.", "info");
        } else {
            console.error("Download error:", err);
            logStatus("❌ Ошибка при сохранении файлов: " + err.message, "error");
            alert("Не удалось сохранить файлы. Убедитесь, что браузер поддерживает File System Access API.");
        }
    }
}


async function saveState() {
    // 1. Local Backup (Safe Mode) - Strip views/revenue to force cloud truth on reload
    try {
        localStorage.setItem('animtube_projects', JSON.stringify(state.projects));
        
        // v4.8: Clean folders for local cache (remove stats and LARGE assets to avoid QuotaExceededError)
        const localFolders = state.folders.map(f => {
            const { views, revenue, assets, avatar, ...rest } = f;
            // Only keep avatar if it's small string (v4.8)
            const cleanAvatar = (avatar && avatar.length < 300000) ? avatar : null;
            return { ...rest, avatar: cleanAvatar }; // Skip assets entirely for local storage
        });
        localStorage.setItem('animtube_folders', JSON.stringify(localFolders));
        localStorage.setItem('animtube_user_avatars', JSON.stringify(state.userAvatars));
    } catch (e) {
        console.warn("⚠️ [Storage Shield]: Local storage full, relying on Cloud sync.", e);
    }

    // Lazy DB Init
    if (!cloudDB) cloudDB = getDB();
    if (!cloudDB || !authState.isLoggedIn) return;

    // Debounce Save (v4.1)
    if (window._saveTimeout) clearTimeout(window._saveTimeout);
    window._saveTimeout = setTimeout(async () => {
        try {
            console.log("💾 [SYNC]: Starting Cloud Save...");
        // A. Batch Save Folders (ONLY for Owner and ONLY if changed)
        // Optimization: Owners only sync folder metadata here. 
        // Targeted sync is handled in saveFolderSettings / updateChannelStats.
        if (authState.user.role === 'owner' && state.folders.length < 20) {
            try {
                const foldersToSave = state.folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    ownedby: f.ownedBy || authState.user.login,
                    assignedto: f.assignedTo || "",
                    niche: f.niche,
                    color: f.color,
                    prefix: f.prefix,
                    scriptPrefix: f.scriptPrefix,
                    splitPrefix: f.splitPrefix,
                    uploadLink: f.uploadLink
                }));
                
                if (foldersToSave.length > 0) {
                    await cloudDB.from('folders').upsert(foldersToSave, { onConflict: 'id' });
                }
            } catch (e) {
                console.warn("⚠️ Background Folder Sync skipped (will retry on next change).");
            }
        }
        // Managers and Partners NEVER batch-sync folders here to prevent timeouts.

        // B. Batch Save Projects
        try {
            const projectsToSave = state.projects.map(p => ({
                id: p.id,
                folderid: p.folderId,
                name: p.name,
                status: Number(p.status || 0),
                created: p.created || new Date().toLocaleDateString(),
                data: {
                    scripts: p.scripts || [],
                    promptsList: p.promptsList || [],
                    results: p.results || [],
                    assets: p.assets || [],
                    audioId: p.audioId || null,
                    prefix: p.prefix || ""
                }
            }));
            
            if (projectsToSave.length > 0) {
                const { error: pErr } = await cloudDB.from('projects').upsert(projectsToSave, { onConflict: 'id' });
                if (pErr) console.warn("⚠️ Project Sync Warning:", pErr);
            }
        } catch (e) {
            console.error("❌ Project Batch Save Failed:", e);
            throw e; // Still throw to show the red dot in UI
        }

        // C. Sync ONLY current user avatar if needed (v2.1 Optimization + Size Guard)
        const myAvatar = state.userAvatars[authState.user.login];
        if (myAvatar && myAvatar.length < 500000) { // Safety limit: ~500KB
            await cloudDB.from('user_avatars').upsert(
                [{ login: authState.user.login, avatar: myAvatar }],
                { onConflict: 'login' }
            );
        }

        // UI Indicators
        var dot = document.getElementById('sync-status-dot');
        var cDot = document.getElementById('cloud-status-indicator');
        const cText = document.getElementById('cloud-status-text');
        const cError = document.getElementById('cloud-error-box');

        if (dot) dot.style.background = '#10b981';
        if (cDot) cDot.style.background = '#10b981';
        if (cText) cText.innerText = 'Синхронизировано';
        if (cError) cError.innerText = '';

        // Trigger UI Refresh if we are on account page to show latest views/revenue
        if (state.activePage === 'account') renderAccountPage();

    } catch (err) {
        console.error("Supabase Sync Error:", err);
        var dot = document.getElementById('sync-status-dot');
        var cDot = document.getElementById('cloud-status-indicator');
        const cText = document.getElementById('cloud-status-text');
        const cError = document.getElementById('cloud-error-box');

        if (dot) dot.style.background = '#ef4444';
        if (cDot) cDot.style.background = '#ef4444';
        if (cText) cText.innerText = 'Ошибка сохранения';
        
        const errorMsg = err.message || "Ошибка соединения с облаком";
        if (cError) cError.innerText = errorMsg;
        logStatus("⚠️ Ошибка сохранения: " + errorMsg, "error");
    }
    }, 1000);
}

// v5.5: Target Sync for heavy columns
async function syncFolderAssets(folderId) {
    if (!cloudDB || !authState.isLoggedIn) return;
    const folder = state.folders.find(f => String(f.id) === String(folderId));
    if (!folder || folder.assets === undefined) return;

    console.log(`📡 [SYNC]: Target syncing assets for folder: ${folder.name}`);
    const { error } = await cloudDB.from('folders')
        .update({ assets: folder.assets })
        .eq('id', folderId);
    
    if (error) {
        console.error("Asset Sync Error:", error);
        logStatus("❌ Ошибка синхронизации ассетов: " + error.message, "error");
    } else {
        logStatus("✅ Ассеты синхронизированы.", "success");
    }
}

async function syncFolderAvatar(folderId) {
    if (!cloudDB || !authState.isLoggedIn) return;
    const folder = state.folders.find(f => String(f.id) === String(folderId));
    if (!folder || folder.avatar === undefined) return;

    console.log(`📡 [SYNC]: Target syncing avatar for folder: ${folder.name}`);
    const { error } = await cloudDB.from('folders')
        .update({ avatar: folder.avatar })
        .eq('id', folderId);
    
    if (error) console.error("Avatar Sync Error:", error);
}


async function loadState() {
    // Force re-init if current DB is broken
    if (!cloudDB || typeof cloudDB.from !== 'function') {
        cloudDB = getDB();
    }
    
    if (!cloudDB || !authState.isLoggedIn) return;
    
    // Prevent overlapping syncs
    if (state.isSyncInProgress) return;
    state.isSyncInProgress = true;

    async function attemptLoad(retryCount = 0) {
        try {
            // Double check .from before calling
            if (typeof cloudDB.from !== 'function') {
                cloudDB = getDB();
                if (!cloudDB) throw new Error("Could not initialize Supabase client");
            }
            
            var dot = document.getElementById('sync-status-dot');
            if (dot) dot.style.background = '#f59e0b'; // Amber - in progress
            logStatus(retryCount > 0 ? `🔄 Попытка синхронизации #${retryCount}...` : "☁️ Синхронизация с облаком...", "info");

        // 1. Load Cloud Folders (v5.1: Metadata first to avoid Timeout/500 on heavy rows)
        const login = authState.user.login;
        // Fetch everything EXCEPT heavy blobs (assets, avatar)
        const metadataColumns = 'id, name, ownedby, assignedto, niche, color, prefix, scriptPrefix, splitPrefix, uploadLink, views, revenue';
        let fQuery = cloudDB.from('folders').select(metadataColumns);
        
        if (authState.user.role === 'owner') {
            fQuery = fQuery.ilike('ownedby', login);
        } else if (authState.user.role === 'manager') {
            fQuery = fQuery;
        } else {
            fQuery = fQuery.or('assignedto.ilike.%' + login + '%,ownedby.ilike.' + login);
        }

        const [folderResult, avatarResult] = await Promise.all([
            fQuery,
            cloudDB.from('user_avatars').select('*').then(res => res).catch(e => { 
                console.warn('⚠️ [Sync Shield]: Avatar fetch failed (500/Network):', e); 
                return { data: null, error: e }; 
            })
        ]);
        const { data: initialFolders, error: fErr } = folderResult;
        let cloudFolders = initialFolders;

        if (fErr) {
            console.error("Folder Load Error:", fErr);
            // FALLBACK: If metadata fetch fails with 500/timeout, try fetching just IDs to at least allow projects to load
            logStatus("⚠️ Ошибка загрузки метаданных (Timeout), пробуем упрощенный режим...", "info");
            const { data: retryFolders, error: rErr } = await cloudDB.from('folders').select('id, name, ownedby, assignedto');
            if (rErr) {
                console.error("Folder Retry Error:", rErr);
                logStatus("❌ Ошибка загрузки каналов: " + rErr.message, "error");
                throw rErr;
            }
            cloudFolders = retryFolders;
        }

        // Apply avatars IMMEDIATELY
        if (avatarResult && avatarResult.data) {
            avatarResult.data.forEach(row => { state.userAvatars[row.login] = row.avatar; });
            try { localStorage.setItem('animtube_user_avatars', JSON.stringify(state.userAvatars)); } catch(e) {}
            renderSidebarProfile(); // v5.0: Show avatar ASAP
        }

        // Apply critical folder fields IMMEDIATELY (views, revenue, avatar, assignments)
        if (cloudFolders && cloudFolders.length > 0) {
            cloudFolders.forEach(cloudItem => {
                const localIdx = state.folders.findIndex(f => String(f.id) === String(cloudItem.id));
                if (localIdx !== -1) {
                    const f = state.folders[localIdx];
                    f.views = cloudItem.views;
                    f.revenue = cloudItem.revenue;
                    f.assignedTo = cloudItem.assignedto;
                    f.ownedBy = cloudItem.ownedby;
                    f.avatar = cloudItem.avatar;
                    f.name = cloudItem.name;
                    f.niche = cloudItem.niche;
                    f.color = cloudItem.color;
                } else {
                    state.folders.push({ ...cloudItem, ownedBy: cloudItem.ownedby, assignedTo: cloudItem.assignedto });
                }
            });
            // Remove local folders deleted from cloud
            const cloudIds = new Set(cloudFolders.map(f => String(f.id)));
            state.folders = state.folders.filter(f => cloudIds.has(String(f.id)) || (Date.now() - Number(f.id)) < 60000);
        }

        // IMMEDIATE RENDER — sidebar, account page and projects show correct data NOW
        renderSidebarProfile();
        if (state.activePage === 'account') renderAccountPage();
        if (state.activePage === 'videos') renderProjects();
        logStatus('✅ Каналы и аватары загружены!', 'success');
        console.log('[SYNC] Phase 1 done: ' + (cloudFolders ? cloudFolders.length : 0) + ' folders loaded.');
        
        console.log("📂 [SYNC] Cloud Folders Loaded:", cloudFolders.length, cloudFolders.map(f => f.name));
        
        // 2. Load Cloud Projects (v5.2: Must include 'data' column to sync scripts and prompts)
        const projectMetadataColumns = 'id, name, folderid, status, created, data';
        let pQuery = cloudDB.from('projects').select(projectMetadataColumns);
        
        if (authState.user.role !== 'owner' && authState.user.role !== 'manager') {
            const allFolderIds = cloudFolders ? cloudFolders.map(f => f.id) : [];
            console.log("🔍 [SYNC] Searching projects for Folder IDs:", allFolderIds);
            if (allFolderIds.length > 0) {
                pQuery = pQuery.in('folderid', allFolderIds);
            } else {
                pQuery = null;
            }
        }
        let cloudProjects = [];
        if (pQuery) {
            const { data: pData, error: pErr } = await pQuery;
            if (pErr) {
                console.error("❌ Project Load Error:", pErr);
                throw pErr;
            }
            cloudProjects = pData || [];
            console.log("📽️ [SYNC] Cloud Projects Loaded:", cloudProjects.length);
        } else {
            console.warn("⚠️ [SYNC] No accessible folders found, skipping project fetch.");
        }

        // v1.9.8: SOURCE OF TRUTH SYNC (Cloud is priority for existence)
        const mergeData = (localArr, cloudArr, forceCloudFields = [], isPartner = false) => {
            const map = new Map();
            
            // 1. First, populate from Cloud (Source of Truth for what exists)
            cloudArr.forEach(cloudItem => {
                // Normalization: Handle case-mismatch between DB and App
                if (cloudItem.ownedby !== undefined && cloudItem.ownedBy === undefined) cloudItem.ownedBy = cloudItem.ownedby;
                if (cloudItem.assignedto !== undefined && cloudItem.assignedTo === undefined) cloudItem.assignedTo = cloudItem.assignedto;

                // Unpack 'data' column if it's a project
                const unpacked = cloudItem.data ? { ...cloudItem, ...cloudItem.data } : cloudItem;
                // v4.9: Force top-level stats to win over legacy JSON data
                if (cloudItem.views !== undefined) unpacked.views = cloudItem.views;
                if (cloudItem.revenue !== undefined) unpacked.revenue = cloudItem.revenue;
                
                if (unpacked.folderid !== undefined && unpacked.folderId === undefined) unpacked.folderId = unpacked.folderid;
                map.set(String(cloudItem.id), unpacked);
            });
            
            // 2. Merge with Local (Source of Truth for latest session changes)
            localArr.forEach(localItem => {
                const localId = String(localItem.id);
                if (map.has(localId)) {
                    const cloudItem = map.get(localId);
                    
                    // Merge: Local wins for state, but cloud can override specific fields
                    const merged = { ...cloudItem, ...localItem };
                    
                    // Respect results/assets deletions in local session
                    if (localItem.results !== undefined) merged.results = localItem.results;
                    if (localItem.assets !== undefined) merged.assets = localItem.assets;

                        forceCloudFields.forEach(f => {
                            const cloudVal = cloudItem[f];
                            if (cloudVal !== undefined && cloudVal !== null && cloudVal !== "") {
                                if (f === 'status') {
                                    if (Number(cloudVal) > Number(localItem.status || 0)) merged[f] = cloudVal;
                                } else if (f === 'views' || f === 'revenue') {
                                    // ALWAYS trust Supabase for views/revenue — managed directly in DB
                                    merged[f] = cloudVal;
                                } else {
                                    // v4.6: Data Protection Shield
                                    // If local modification is fresher than 2 mins, DO NOT let old cloud data revert it.
                                    const localAge = Date.now() - (localItem._lastChangeAt || 0);
                                    if (localAge > 120000) { // 2 minutes
                                        merged[f] = cloudVal;
                                    } else {
                                        console.log(`🛡️ [Data Shield]: Blocking cloud overwrite for ${f} (Local change is fresh)`);
                                    }
                                }
                            }
                        });
                    map.set(localId, merged);
                } else {
                    // Local item doesn't exist in cloud - it was either deleted or is brand new (not yet synced)
                    const isNew = (Date.now() - Number(localItem.id || 0)) < 60000; 
                    if (isNew) {
                        map.set(localId, localItem);
                    }
                }
            });
            
            return Array.from(map.values());
        };

        if (cloudFolders) {
            // v3.1: Prioritize Cloud for shared state fields (Assignments & Stats)
            state.folders = mergeData(state.folders, cloudFolders, ['assignedTo', 'niche', 'prefix', 'scriptPrefix', 'splitPrefix', 'uploadLink', 'views', 'revenue'], false);
            

        }

        if (cloudProjects) {
            const isPartner = authState.user.role !== 'owner' && authState.user.role !== 'manager';
            const folderIds = new Set(state.folders.map(f => String(f.id)));
            
            // Unpack 'data' column for all cloud projects
            const unpackedProjects = cloudProjects.map(p => {
                const item = p.data ? { ...p, ...p.data } : p;
                if (item.folderid !== undefined && item.folderId === undefined) item.folderId = item.folderid;
                return item;
            });

            if (isPartner) {
                // PARTNERS: Cloud is the ONLY truth for projects too.
                state.projects = unpackedProjects.filter(p => folderIds.has(String(p.folderId)));
            } else {
                // OWNERS: Merge local and cloud, but do NOT force 'status' from cloud if local exists.
                // This prevents losing a recently clicked checkbox during a background sync.
                state.projects = mergeData(state.projects, unpackedProjects, []).filter(p => folderIds.has(String(p.folderId)));
            }
        }

        // 4. Load Avatars (Soft Fetch - Don't break sync if this fails)
        try {
            const { data: aData } = await cloudDB.from('user_avatars').select('*');
            if (aData) {
                aData.forEach(row => {
                    // v3.2: Always prioritize cloud avatar for sync
                    state.userAvatars[row.login] = row.avatar;
                });
            }
        } catch (e) {
            console.warn("⚠️ [Sync Shield]: Avatars failed to load, continuing...", e);
        }

        // 5. Initial Sync Back (Upload local data to cloud if it was just merged)
        var dot = document.getElementById('sync-status-dot');
        var cDot = document.getElementById('cloud-status-indicator');
        if (dot) dot.style.background = '#10b981';
        if (cDot) cDot.style.background = '#10b981';

        state.isSyncInProgress = false;
        return true;

    } catch (err) {
        console.error("Supabase Load Error:", err);
        
        // Handle 504/Timeout with Retries
        const isTimeout = err.message?.includes("timeout") || err.status === 504 || err.code === 'PGRST504';
        
        if (isTimeout && retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000;
            logStatus(`⚠️ Таймаут базы данных. Повтор через ${delay/1000} сек...`, "info");
            await new Promise(r => setTimeout(r, delay));
            return await attemptLoad(retryCount + 1);
        }

        var dot = document.getElementById('sync-status-dot');
        var cDot = document.getElementById('cloud-status-indicator');
        const cError = document.getElementById('cloud-error-box');

        if (dot) dot.style.background = '#ef4444';
        if (cDot) cDot.style.background = '#ef4444';
        
        const errorMsg = err.message || "Ошибка соединения с облаком";
        if (cError) cError.innerText = errorMsg;
        
        logStatus("❌ Ошибка синхронизации: " + errorMsg, "error");
        state.isSyncInProgress = false;
        return false;
    }
    }

    return await attemptLoad();
}

// --- BATCH GENERATION ---
async function _startRollAssembly() {
    console.log("🚀 [DEBUG] Нажата кнопка Начать сборку");
    try {
        const project = getCurrentProject();
        console.log("🚀 [DEBUG] Текущий проект:", project ? project.name : "NULL");
        
        if (!project || !project.promptsList || project.promptsList.length === 0) {
            console.warn("⚠️ [DEBUG] Список промптов пуст или проект не найден.");
            return alert("Добавьте хотя бы один промт!");
        }
        
        // Filter only uncompleted prompts
        const queue = project.promptsList
            .map((p, idx) => ({ ...p, originalIndex: idx }))
            .filter(p => !p.isGeminiDone);
        
        console.log("🚀 [DEBUG] Очередь создана, длина:", queue.length);
        
        if (queue.length === 0) {
            return alert("Все кадры в этом проекте уже помечены как готовые!");
        }

        state.assembly.queue = queue;
        state.assembly.currentIdx = 0;
        state.assembly.isRunning = true;
        state.assembly.lockedProjectId = state.activeProjectId;
        
        const btnStart = document.getElementById('btn-start-assembly');
        const btnStop = document.getElementById('btn-stop-assembly');
        const slot = document.getElementById('receiving-slot-panel');
        
        if (btnStart) btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'flex';
        if (slot) slot.style.display = 'block';
        
        logStatus(`🎬 Пакетная сборка запущена (${queue.length} кадров).`, "info");
        console.log("🚀 [DEBUG] Запуск processNextItem...");
        processNextItem();
    } catch (e) {
        console.error("❌ [CRITICAL ERROR] startRollAssembly failed:", e);
        logStatus("❌ Ошибка запуска: " + e.message, "error");
    }
}

function _stopRollAssembly(isManual = true) {
    state.assembly.isRunning = false;
    clearTimeout(state.assembly.timerId);
    document.getElementById('btn-start-assembly').style.display = 'flex';
    document.getElementById('btn-stop-assembly').style.display = 'none';
    
    if (isManual) {
        logStatus("🛑 Сборка остановлена.", "error");
    }
}

// --- FOLDER-LEVEL ASSET LIBRARY (v12) ---
window.triggerFolderAssetUpload = () => {
    const name = document.getElementById('folder-asset-name').value.trim();
    if (!name) return alert("Введите имя ассета!");
    document.getElementById('folder-asset-file').click();
};

// --- IMAGE COMPRESSION HELPER (v1.3.9) ---
async function compressImage(base64, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = base64;
    });
}

window.handleAddFolderAsset = async (input) => {
    const nameInput = document.getElementById('folder-asset-name');
    const name = nameInput.value.trim();
    if (!input.files || !input.files[0] || !state.currentFolderId) return;

    const folder = state.folders.find(f => f.id === state.currentFolderId);
    if (!folder) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const rawBase64 = e.target.result;
        logStatus("⌛ Сжатие изображения...", "info");
        const base64 = await compressImage(rawBase64); 
        
        const assetId = "asset_" + Date.now();
        
        const newAsset = { id: assetId, base64, name, folderid: state.currentFolderId };
        
        if (!folder.assets) folder.assets = [];
        folder.assets.push(newAsset);
        
        nameInput.value = "";
        input.value = "";
        saveState(); // For metadata if needed
        renderFolderAssets();
        syncFolderAssets(state.currentFolderId); // v5.5: Immediate targeted sync
        logStatus(`📦 Ассет "${name}" добавлен.`, "success");
    };
    reader.readAsDataURL(file);
};


async function syncStateToCloud() {
    await saveState();
}
window.syncStateToCloud = syncStateToCloud;

async function renderFolderAssets() {
    const container = document.getElementById('folder-assets-list');
    if (!container || !state.currentFolderId) return;

    const folder = state.folders.find(f => f.id === state.currentFolderId);
    if (!folder || !folder.assets || folder.assets.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 20px; font-size:12px;">Ассеты не добавлены.</p>`;
        return;
    }

    container.innerHTML = folder.assets.map(a => `
        <div class="lib-card" style="position: relative;">
            <img src="${a.base64}" class="lib-img" style="height: 60px;">
            <div class="lib-info" style="padding: 5px;">
                <div style="font-weight: 700; font-size: 11px;">${a.name}</div>
            </div>
            <button class="lib-del-btn" onclick="deleteFolderAsset('${a.id}')">×</button>
        </div>
    `).join('');
}

async function deleteFolderAsset(id) {
    if (!confirm("Удалить этот ассет?")) return;
    const folder = state.folders.find(f => String(f.id) === String(state.currentFolderId));
    if (!folder || !folder.assets) return;

    // Use String comparison because a.id might be a number from the cloud, and id is a string from the HTML onclick
    folder.assets = folder.assets.filter(a => String(a.id) !== String(id));
    saveState(); // For metadata
    renderFolderAssets();
    syncFolderAssets(state.currentFolderId); // v5.5: Immediate targeted sync
}

// --- PROJECT ASSET SELECTION ---
function openAssetSelectorModal() {
    // Simple implementation: Show all global assets in the terminal with "Add" buttons
    // In a real app, this would be a proper modal
    const transaction = db.transaction(["assets"], "readonly");
    const request = transaction.objectStore("assets").getAll();

    request.onsuccess = () => {
        const allAssets = request.result;
        const project = getCurrentProject();
        if (!project.assets) project.assets = [];

        logStatus("📋 ВЫБЕРИТЕ АССЕТЫ ДЛЯ ЭТОГО ПРОЕКТА:", "info");
        allAssets.forEach(a => {
            const isSelected = project.assets.some(pa => pa.id === a.id);
            if (!isSelected) {
                const entry = document.createElement('div');
                entry.style.display = 'flex';
                entry.style.justifyContent = 'space-between';
                entry.style.padding = '5px';
                entry.style.borderBottom = '1px solid #333';
                entry.innerHTML = `
                    <span>${a.name}</span>
                    <button onclick="toggleAssetForProject('${a.id}', true)" style="background:var(--accent-primary); color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer;">Добавить</button>
                `;
                document.getElementById('studio-terminal').appendChild(entry);
            }
        });
    };
}

window.toggleAssetForProject = (id, add) => {
    const project = getCurrentProject();
    if (!project.assets) project.assets = [];
    
    if (add) {
        const transaction = db.transaction(["assets"], "readonly");
        const req = transaction.objectStore("assets").get(id);
        req.onsuccess = () => {
            const asset = req.result;
            if (asset && !project.assets.some(a => a.id === id)) {
                project.assets.push({ id: asset.id, name: asset.name });
                saveState();
                renderProjectAssets();
                logStatus(`✅ Ассет "${asset.name}" привязан к проекту.`, "success");
            }
        };
    } else {
        project.assets = project.assets.filter(a => a.id !== id);
        saveState();
        renderProjectAssets();
    }
};

async function renderProjectAssets() {
    const container = document.getElementById('folder-assets-list');
    if (container) renderFolderAssets();
}

// --- HELPER: RUSSIAN-FRIENDLY MATCHING v2 (v11.7) ---
// --- HELPER: RUSSIAN-FRIENDLY MATCHING v3 (Precise & Strict) ---
function isAssetMatch(prompt, assetName) {
    if (!prompt || !assetName) return false;
    const p = prompt.toLowerCase();
    const n = assetName.toLowerCase().trim();
    
    // 1. Direct match (Full name)
    if (p.includes(n)) return true;
    
    // 2. Strict matching for multi-word assets (e.g., "Peppa Pig")
    const words = n.split(/\s+/).filter(w => w.length >= 2);
    if (words.length > 1) {
        // Require ALL significant words to be present in the prompt
        return words.every(word => {
            const root = word.replace(/(ий|ый|ой|ая|яя|ое|ее|ую|юю|ых|их|ими|ыми|ого|его|ому|ему|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|й|ь)$/, '');
            if (root.length < 3) return p.includes(word);
            return new RegExp(root, 'i').test(p);
        });
    }

    // 3. Fallback for single word
    const root = n.replace(/(ий|ый|ой|ая|яя|ое|ее|ую|юю|ых|их|ими|ыми|ого|его|ому|ему|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|й|ь)$/, '');
    if (root.length < 3) return p.includes(n);
    return new RegExp(root, 'i').test(p);
}

async function processNextItem() {
    console.log("🚀 [DEBUG] processNextItem: Обработка следующего кадра. Текущий индекс:", state.assembly.currentIdx);
    if (!state.assembly.isRunning) {
        console.warn("🛑 [DEBUG] processNextItem: Сборка не запущена (isRunning=false).");
        return;
    }

    if (state.assembly.currentIdx >= state.assembly.queue.length) {
        logStatus("✅ Пакетная сборка завершена!", "success");
        stopRollAssembly(false);
        
        // AUTO-TRANSITION (v1.3.8)
        if (state.isAutoMode || (state.assembly.superAuto && state.assembly.superAuto.active)) {
            logStatus("⏳ [АВТО]: Кадры готовы. Переход к анимации через 5 секунд...", "info");
            setTimeout(() => {
                // Ensure we are still in auto mode and on the workspace page
                if ((state.isAutoMode || state.assembly.superAuto.active) && state.activePage === 'workspace') {
                    switchProjectTab('animation');
                    logStatus("🎬 [АВТО]: Вкладка анимации активна. Запуск сборки...", "success");
                    
                    // Small delay to ensure tab is rendered and buttons are reachable
                    setTimeout(() => {
                        startAnimationAssembly();
                    }, 2000);
                }
            }, 5000);
        }
        return;
    }

    const item = state.assembly.queue[state.assembly.currentIdx];
    const rawPrompt = item.text;
    
    const project = getCurrentProject();
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    // v1.9.8: Improved prefix detection - check if start of text matches prefix (ignoring whitespace)
    const cleanRaw = rawPrompt.trim();
    const cleanPrefix = prefix.trim();
    const hasPrefix = cleanRaw.toLowerCase().startsWith(cleanPrefix.toLowerCase()) || cleanRaw.includes(cleanPrefix);
    
    const fullPrompt = hasPrefix ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
    
    // EXPLICIT CLIPBOARD COPY (v1.3.2 - Zero-Click Fix)
    copyTextToClipboard(fullPrompt); // No await to prevent hanging
    logStatus(`📋 [Промт ${state.assembly.currentIdx + 1}]: Текст подготовлен.`, "success");
    
    state.assembly.isWaitingForImage = true;
    
    const slotBox = document.getElementById('capture-slot');
    if (slotBox) {
        slotBox.className = 'receiving-box waiting';
        slotBox.innerHTML = `
            <div class="transfer-status">
                <span class="loading-icon" style="font-size: 40px; display: block; margin-bottom: 15px;">⏳</span>
                <p id="receiving-text">ОЖИДАНИЕ ПЕРЕДАЧИ ИЗ GEMINI...</p>
                <button id="btn-auto-paste" class="btn-auto-paste">
                    <span class="btn-icon">⚡</span> ВСТАВИТЬ КАДР (АВТО)
                </button>
                <div style="margin-top: 10px; opacity: 0.5; font-size: 11px;">
                    [Промт ${state.assembly.currentIdx + 1}/${state.assembly.queue.length}]
                </div>
            </div>
        `;
        // Re-bind the auto-paste logic to the newly injected button
        const btn = document.getElementById('btn-auto-paste');
        if (btn) {
            btn.onclick = async () => {
                btn.classList.add('triggering');
                if (state.assembly.pendingImage) {
                    handleIncomingImage(state.assembly.pendingImage);
                    state.assembly.pendingImage = null;
                    setTimeout(() => btn.classList.remove('triggering'), 500);
                    return;
                }
                
                // Fallback to Clipboard API
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    for (const item of clipboardItems) {
                        for (const type of item.types) {
                            if (type.startsWith("image/")) {
                                const blob = await item.getType(type);
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    handleIncomingImage(e.target.result);
                                    btn.classList.remove('triggering');
                                };
                                reader.readAsDataURL(blob);
                                return;
                            }
                        }
                    }
                } catch (err) {
                    logStatus("⚠️ Нажмите Ctrl+V вручную", "error");
                }
                setTimeout(() => btn.classList.remove('triggering'), 500);
            };
        }
        slotBox.focus();
    }

    logStatus(`🛰️ [${state.assembly.currentIdx + 1}/${state.assembly.queue.length}] Анализ промта...`, "info");
    
    // ASSET SCANNING (v11.8 Indicator Update)
    const matchingAssets = [];
    const matchedNames = [];
    const matchedIds = [];
    
    // Reset Indicator
    const indicator = document.getElementById('detection-indicator');
    if (indicator) {
        indicator.innerHTML = `🛰️ Анализ ассетов...`;
        indicator.className = 'detection-bar-working';
    }

    // Clear previous highlights
    document.querySelectorAll('.asset-matched').forEach(el => el.classList.remove('asset-matched'));

    // New Asset Scanning Logic (v12 Channel-Level)
    if (folder && folder.assets) {
        for (const asset of folder.assets) {
            if (isAssetMatch(rawPrompt, asset.name)) {
                matchedNames.push(asset.name);
                matchedIds.push(asset.id);
                matchingAssets.push(asset.base64);
            }
        }
    }
    
    // Store for Phase 2 (v11.15)
    state.assembly.currentMatchedIds = matchedIds;
    
    if (indicator) {
        if (matchedNames.length > 0) {
            indicator.innerHTML = `✅ Обнаружено: ${matchedNames.join(', ')}`;
            indicator.className = 'detection-bar-success';
            logStatus(`🚀 Используется локация: нужно её взять (${matchedNames.join(', ')})...`, "success");
        } else {
            indicator.innerHTML = `❌ Ассеты не найдены в этом промте.`;
            indicator.className = 'detection-bar-empty';
        }
    }
    
    // Short pause for user to see the highlight
    if (matchingAssets.length > 0) {
        await new Promise(r => setTimeout(r, 1200));
    }

    // PREVIOUS FRAME LOGIC (v12.6 One-Trip Consistency)
    let prevFrameData = null;
    if (project.results && project.results.length > 0) {
        const lastFrame = project.results[0]; // results are unshifted (newest first)
        if (lastFrame && lastFrame.id) {
            prevFrameData = await getImageFromDB(lastFrame.id);
            if (prevFrameData) {
                logStatus("🖼️ [Контекст]: Предыдущий кадр добавлен в пакет отправки.", "info");
            }
        }
    }

    state.assembly.lastSentPrompt = fullPrompt;
    
    // ONE TRIP: Send everything (Reference + Text + Assets)
    console.log("🚀 [DEBUG] processNextItem: Sending TO_GEMINI command...");
    logStatus("🛰️ [Bridge]: Отправка команды в расширение...", "info");
    
    sendToBridge({ 
        type: "TO_GEMINI", 
        msgId: Date.now() + "-" + Math.random(),
        prompt: fullPrompt,
        assets: matchingAssets,
        assetIds: matchedIds,
        prevFrame: prevFrameData // The "Memory" frame
    });
    
    state.assembly.currentIdx++;
    updateProgressUI();
    renderQueue();
}

function updateProgressUI() {
    const total = state.assembly.queue.length;
    const current = state.assembly.currentIdx;
    const percent = (current / total) * 100;
    document.getElementById('assembly-progress-fill').style.width = `${percent}%`;
    document.getElementById('assembly-counter').innerText = `${current} / ${total} Промтов отправлено`;
}

function renderQueue() {
    const container = document.getElementById('queue-display');
    if (!container) return;
    
    container.innerHTML = state.assembly.queue.map((p, i) => {
        let statusClass = 'status-pending';
        let statusText = 'Ждет';
        
        if (i < state.assembly.currentIdx - 1) {
            statusClass = 'status-done';
            statusText = 'Готово';
        } else if (i === state.assembly.currentIdx - 1) {
            statusClass = 'status-working';
            statusText = state.assembly.isWaitingForImage ? 'В работе' : 'Готово';
        }

        return `
            <div class="queue-item ${i === state.assembly.currentIdx - 1 ? 'active' : ''}">
                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px;">
                    ${p}
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// --- IMAGE HANDLING ---
async function handleIncomingImage(base64) {
    // Gallery Isolation: Use locked ID if in batch mode
    const targetId = state.assembly.isRunning ? state.assembly.lockedProjectId : state.activeProjectId;
    const project = state.projects.find(p => p.id == targetId);
    if (!project) return;

    // Visual Flash & Animation
    const flash = document.createElement('div');
    flash.className = 'paste-flash-overlay flash-active';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    const slotBox = document.getElementById('capture-slot');
    if (slotBox) {
        slotBox.className = 'receiving-box success';
        slotBox.innerHTML = `
            <img src="${base64}" style="animation: dropIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);">
            <div class="slot-label">🎉 КАДР УСПЕШНО ВСТАВЛЕН</div>
        `;
    }

    const preview = document.getElementById('preview-frame');
    if (preview) {
        preview.src = base64;
        preview.style.display = 'block';
        if (document.getElementById('canvas-empty')) document.getElementById('canvas-empty').style.display = 'none';
    }

    const imgId = "img_" + Date.now();
    const compressedBase64 = await compressImage(base64);
    await saveImageToDB(imgId, compressedBase64);
    await saveImageToCloud(imgId, compressedBase64); 

    const result = {
        id: imgId,
        promptSnippet: state.assembly.lastSentPrompt || "User Image",
        time: new Date().toLocaleTimeString()
    };
    project.results.unshift(result);
    
    if (state.assembly.isRunning && state.assembly.queue[state.assembly.currentIdx - 1]) {
        const item = state.assembly.queue[state.assembly.currentIdx - 1];
        const originalPrompt = project.promptsList[item.originalIndex];
        if (originalPrompt) {
            originalPrompt.isGeminiDone = true;
            originalPrompt.resultId = imgId;
        }
    }

    saveState();
    
    renderProjectLibrary();
    if (document.getElementById('tab-content-animation').classList.contains('active')) {
        renderProjectAnimation();
    }
    logStatus("✅ Кадр добавлен в библиотеку проекта.", "success");

    if (state.assembly.isRunning && state.assembly.isWaitingForImage) {
        state.assembly.isWaitingForImage = false;
        renderQueue();
        
        // CHECK FOR COMPLETION (v1.3.9 Fix for AUTO mode)
        if (state.assembly.currentIdx >= state.assembly.queue.length) {
            logStatus("✅ Пакетная сборка полностью завершена!", "success");
            _stopRollAssembly(false);
            
            const isAnyAuto = state.isAutoMode || (state.assembly.superAuto && state.assembly.superAuto.active);
            if (isAnyAuto) {
                logStatus("⏳ [АВТО]: Все кадры получены. Переход к анимации через 3 секунды...", "info");
                setTimeout(() => {
                    if (state.activePage === 'workspace') {
                        switchProjectTab('animation');
                        logStatus("🎬 [АВТО]: Вкладка анимации активна. Запуск сборки...", "success");
                        setTimeout(() => {
                            if (typeof startAnimationAssembly === 'function') startAnimationAssembly();
                        }, 2500);
                    }
                }, 3000);
            }
            return;
        }

        // Wait 4s (v10.3) to show success/flash before next prompt
        logStatus("⏳ Пауза 4 сек перед следующим промтом...", "info");
        setTimeout(processNextItem, 4000);
    }
}

async function renderProjectLibrary() {
    const project = getCurrentProject();
    const container = document.getElementById('project-library-container');
    if (!project || !container) return;

    if (project.results.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">Библиотека пуста. Ожидайте авто-вставку.</p>`;
        return;
    }

    container.innerHTML = "";
    for (const res of project.results) {
        const card = document.createElement('div');
        card.className = "lib-card";
        card.id = `lib-card-${res.id}`;
        
        // Initial placeholder state
        card.innerHTML = `
            <div class="lib-img-placeholder" style="height: 100px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); color: var(--text-dim); font-size: 10px;">⌛ Загрузка...</div>
            <div class="lib-info">
                <div class="lib-prompt">"${res.promptSnippet}"</div>
                <div style="font-size: 10px; opacity: 0.5; margin-top: 5px;">${res.time}</div>
            </div>
            <button class="lib-del-btn" onclick="event.stopPropagation(); deleteFrame('${res.id}')">×</button>
        `;
        container.appendChild(card);

        // Async load the actual image
        getImageFromDB(res.id).then(imgData => {
            if (imgData) {
                const imgPlaceholder = card.querySelector('.lib-img-placeholder');
                if (imgPlaceholder) {
                    const img = document.createElement('img');
                    img.src = imgData;
                    img.className = "lib-img";
                    imgPlaceholder.replaceWith(img);
                    
                    card.onclick = () => {
                        const preview = document.getElementById('preview-frame');
                        if (preview) {
                            preview.src = imgData;
                            preview.style.display = 'block';
                            if (document.getElementById('canvas-empty')) document.getElementById('canvas-empty').style.display = 'none';
                        }
                    };
                }
            } else {
                const placeholder = card.querySelector('.lib-img-placeholder');
                if (placeholder) placeholder.innerText = "❌ Нет в облаке";
            }
        });
    }
}

async function syncAllImagesToCloud() {
    logStatus("🛰️ Запуск принудительной синхронизации всех кадров...", "info");
    let count = 0;
    let total = 0;

    // Iterate through all projects and all results
    for (const project of state.projects) {
        if (project.results) {
            for (const res of project.results) {
                total++;
                // Check local IndexedDB first
                const transaction = db.transaction(["images"], "readonly");
                const store = transaction.objectStore("images");
                const request = store.get(res.id);
                
                await new Promise((resolve) => {
                    request.onsuccess = async () => {
                        if (request.result) {
                            // Upload if exists locally
                            await saveImageToCloud(res.id, request.result.base64);
                            count++;
                        }
                        resolve();
                    };
                    request.onerror = () => resolve();
                });
            }
        }
    }
    
    logStatus(`✅ Синхронизация завершена! Выгружено в облако: ${count} из ${total} кадров.`, "success");
    alert(`Синхронизация завершена! ${count} кадров теперь доступны в облаке.`);
}

window.syncAllImagesToCloud = syncAllImagesToCloud;

async function _deleteFrame(id) {
    if (!confirm("Удалить кадр?")) return;
    
    const project = getCurrentProject();
    if (!project) return;

    // 1. Instant UI disappearance
    const card = document.getElementById(`lib-card-${id}`);
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(() => card.remove(), 300);
    }

    // 2. Remove from results list
    project.results = project.results.filter(r => String(r.id) !== String(id));
    
    // 3. HARD CLOUD CLEANUP (Wait for it)
    if (cloudDB && authState.isLoggedIn) {
        try {
            // Delete image row from cloud
            const { error: imgErr } = await cloudDB.from('project_images').delete().eq('id', id);
            if (imgErr) console.error("Cloud Image Delete Error:", imgErr);
            
            // Delete from projects table (metadata)
            // Instead of manual update, we'll let saveState() handle the batch upsert 
            // which includes all project fields (scripts, assets, results, etc.)
            await saveState(); 
            
            console.log("☁️ Cloud Cleanup Sync Complete.");
        } catch (e) {
            console.error("Cloud Sync Error during delete:", e);
        }
    }
    
    // 4. Local DB cleanup
    try {
        const transaction = db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");
        store.delete(id);
    } catch (e) { console.warn("Local DB Delete Warning:", e); }
    
    logStatus("✅ Кадр удален навсегда.", "success");
}

// --- UTILS ---
function getCurrentProject() {
    // Use == for flexible ID comparison (string vs number)
    return state.projects.find(p => p.id == state.activeProjectId);
}

function logStatus(msg, type) {
    console.log(`[STATUS] (${type}): ${msg}`);
    const terminal = document.getElementById('studio-terminal') || document.getElementById('receiving-text');
    if (!terminal) return;
    
    if (terminal.id === 'receiving-text') {
        terminal.innerText = msg.toUpperCase();
        return;
    }

    const entry = document.createElement('div');
    entry.style.color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#6366f1');
    entry.style.marginBottom = '4px';
    entry.innerHTML = `<span style="opacity:0.4">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}


function createCursor() {
    const c = document.createElement('div');
    c.id = 'digital-cursor';
    c.className = 'digital-cursor';
    document.body.appendChild(c);
    return c;
}

async function runVisualCopyAnimation(assetIds) {
    if (!assetIds || assetIds.length === 0) return;
    
    logStatus("🎭 Робот возвращается для визуального копирования...", "info");
    
    for (const id of assetIds) {
        let card = document.querySelector(`[data-asset-id="${id}"]`);
        
        // v1.3.1 - Support for specific ID targeting (for Animation Tab)
        if (!card && id.startsWith('anim-frame-')) {
            card = document.getElementById(id);
        }
        
        if (!card) continue;
        
        // 1. Scroll & Mouse Move
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('asset-matched');
        
        const cursor = document.getElementById('digital-cursor') || createCursor();
        const rect = card.getBoundingClientRect();
        cursor.classList.add('active');
        cursor.style.left = `${rect.left + rect.width/2}px`;
        cursor.style.top = `${rect.top + rect.height/2}px`;
        
        await new Promise(r => setTimeout(r, 800)); // Move time
        
        // 2. Click & Menu
        cursor.classList.add('click');
        const menu = document.createElement('div');
        menu.className = 'fake-context-menu';
        menu.innerHTML = `
            <div class="context-item">Открыть в новой вкладке</div>
            <div class="context-item">Сохранить как...</div>
            <div class="context-item active">Копировать изображение</div>
            <div class="context-item">Найти через Google</div>
        `;
        card.appendChild(menu);
        
        card.classList.add('asset-copying');
        logStatus(`📸 Копирую: ${id}...`, "info");
        
        await new Promise(r => setTimeout(r, 1200));
        
        cursor.classList.remove('click');
        menu.remove();
        card.classList.remove('asset-copying');
        cursor.classList.remove('active');
        logStatus(`✅ Копирование завершено.`, "success");
    }
}

// --- PROMPT BUILDER (v11.19) ---
function renderProjectPrompts() {
    const project = getCurrentProject();
    const container = document.getElementById('prompt-list-builder');
    if (!project || !container) return;

    if (!project.promptsList) project.promptsList = [];

    container.innerHTML = project.promptsList.map((p, index) => {
        const isProcessing = state.assembly.isRunning && 
                             state.assembly.queue.length > 0 && 
                             state.assembly.queue[state.assembly.currentIdx - 1] === p;
        
        const isDone = p.isGeminiDone;
                             
        return `
            <div class="prompt-item ${isProcessing ? 'processing' : ''} ${isDone ? 'done' : ''}" id="prompt-item-${index}">
                <div class="prompt-header">
                    <div class="prompt-counter">${index + 1}</div>
                    <div class="prompt-status-check">
                        <div style="font-size: 9px; opacity: 0.6; font-weight: bold; letter-spacing: 1px;">
                            ${isDone ? '✨ ЗАВЕРШЕНО' : '⏳ ОЖИДАНИЕ'}
                        </div>
                    </div>
                </div>
                <textarea class="prompt-textarea" 
                          onchange="updatePromptValue(${index}, this.value)" 
                          placeholder="Опишите, что происходит в этом кадре...">${p.text}</textarea>
                <div class="prompt-actions">
                    <button class="prompt-btn prompt-btn-recreate" onclick="recreateSinglePrompt(${index})" title="Пересоздать">
                        <span>🔄</span>
                    </button>
                    <button class="prompt-btn prompt-btn-upload" onclick="uploadFrameForPrompt(${index})" title="Загрузить кадр с устройства">
                        <span>📁</span>
                    </button>
                    <button class="prompt-btn prompt-btn-del" onclick="deletePromptFromProject(${index})" title="Удалить промт">
                        <span>🗑️</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.uploadFrameForPrompt = function(index) {
    const project = getCurrentProject();
    if (!project) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        logStatus(`⌛ Загрузка кадра для промта #${index + 1}...`, "info");
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const rawBase64 = event.target.result;
            const base64 = await compressImage(rawBase64);
            
            const imgId = "img_manual_" + Date.now();
            await saveImageToDB(imgId, base64);
            await saveImageToCloud(imgId, base64);
            
            const prompt = project.promptsList[index];
            const result = {
                id: imgId,
                promptSnippet: prompt ? prompt.text.substring(0, 30) + "..." : "Manual Upload",
                time: new Date().toLocaleTimeString()
            };
            
            project.results.unshift(result);
            if (prompt) {
                prompt.isGeminiDone = true;
                prompt.resultId = imgId; // CRITICAL: Link image to prompt for Animation tab
            }
            
            saveState();
            renderProjectPrompts();
            renderProjectLibrary();
            
            logStatus("✅ Кадр успешно загружен и привязан к промту.", "success");
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
};

window.toggleGeminiDone = (index, isDone) => {
    const project = getCurrentProject();
    if (project && project.promptsList[index]) {
        project.promptsList[index].isGeminiDone = isDone;
        saveState();
        renderProjectPrompts();
        // Also update animation tab if it's mirrored
        if (document.getElementById('tab-content-animation').classList.contains('active')) {
            renderProjectAnimation();
        }
    }
};

// --- VOICEOVER MANAGEMENT (v1.6) ---
async function renderProjectVoice() {
    const project = getCurrentProject();
    const container = document.getElementById('voice-content-container');
    if (!project || !container) return;

    // v1.6.2: Link Detection logic (same as in openProject)
    const folder = getFolderForProject(project.id);
    let link = (folder && folder.uploadLink) ? folder.uploadLink : null;
    if (folder && (!link || link.trim() === "")) {
         const clean = (s) => s.toString().toUpperCase().replace(/[^A-ZА-Я0-9]/g, "");
         const target = clean(folder.name);
         for (const [key, hLink] of Object.entries(HARDCODED_LINKS)) {
             if (clean(key) === target) { link = hLink; break; }
         }
    }

    if (!project.audioId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 24px;">
                <div style="font-size: 56px; opacity: 0.3;">🎵</div>
                <div>
                    <p style="margin: 0; font-size: 16px; color: white; font-weight: 700;">Озвучка еще не загружена</p>
                    <p style="margin: 5px 0 0 0; font-size: 13px;">Используйте кнопку ниже, чтобы перейти в папку проекта.</p>
                </div>
                
                <div style="display: flex; gap: 16px; align-items: center;">
                    ${link ? `
                        <button class="btn btn-primary" onclick="window.open('${link}', '_blank')" 
                                style="background: linear-gradient(135deg, #10b981, #059669); padding: 16px 32px; border-radius: 16px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2); border: none; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
                            <span>🔗</span> ВЗЯТЬ ОЗВУЧКУ
                        </button>
                    ` : '<p style="font-size:12px; opacity:0.5;">(Ссылка на папку не найдена)</p>'}
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Загрузка аудио...</p></div>`;

    const base64 = await getAudioFromDB(project.audioId);
    
    if (!base64) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--accent-error);">
                <p>❌ Ошибка: Аудиофайл не найден в базе данных.</p>
                <button class="btn btn-secondary" onclick="deleteProjectAudio('${project.audioId}')">Сбросить и загрузить заново</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="glass-panel" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 30px;">
            <div style="font-size: 60px;">🔊</div>
            <div style="width: 100%;">
                <audio controls style="width: 100%; height: 50px;">
                    <source src="${base64}" type="audio/mpeg">
                    Ваш браузер не поддерживает элемент audio.
                </audio>
            </div>
            <div style="display: flex; gap: 12px; width: 100%;">
                <a href="${base64}" download="Voiceover_${project.name}.mp3" class="btn btn-secondary" style="flex: 1; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    📥 Скачать файл
                </a>
                <button class="btn btn-danger" onclick="deleteProjectAudio('${project.audioId}')" style="flex: 0.3;">
                    🗑️ Удалить
                </button>
            </div>
            
            ${link ? `
                <button class="btn btn-primary" onclick="window.open('${link}', '_blank')" 
                        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 12px; font-size: 12px; color: var(--text-secondary); cursor: pointer; margin-top: 10px;">
                    📂 Открыть папку с озвучкой
                </button>
            ` : ''}
        </div>
    `;
}

async function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) { // 25MB limit
        alert("⚠️ Файл слишком большой! Максимальный размер: 25MB");
        return;
    }

    const project = getCurrentProject();
    if (!project) return;

    logStatus("🎙️ Загрузка аудиофайла...", "info");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;
        const audioId = "audio-" + Date.now();
        
        try {
            await saveAudioToDB(audioId, base64);
            await saveAudioToCloud(audioId, base64);
            
            project.audioId = audioId;
            saveState();
            renderProjectVoice();
            logStatus("✅ Озвучка успешно загружена и привязана к проекту!", "success");
        } catch (err) {
            console.error("Audio Upload Error:", err);
            logStatus("❌ Ошибка при сохранении аудио.", "error");
        }
    };
    reader.readAsDataURL(file);
}

async function deleteProjectAudio(id) {
    if (!confirm("Вы уверены, что хотите удалить озвучку из проекта?")) return;
    
    const project = getCurrentProject();
    if (project && project.audioId === id) {
        project.audioId = null;
        saveState();
        renderProjectVoice();
        logStatus("🗑️ Озвучка удалена из проекта.", "info");
    }
}
async function renderProjectAnimation() {
    const project = getCurrentProject();
    const container = document.getElementById('animation-list-container');
    if (!project || !container) return;

    if (!project.promptsList || project.promptsList.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="text-align: center; color: var(--text-dim); padding: 60px;">
            <span style="font-size: 40px; display: block; margin-bottom: 20px;">🎬</span>
            Очередь анимации пуста. Сгенерируйте кадры во вкладке «Кадры».
        </div>`;
        return;
    }

    let html = "";
    
    for (let i = 0; i < project.promptsList.length; i++) {
        const item = project.promptsList[i];
        
        let imgTag = "";
        if (item.resultId) {
            const base64 = await getImageFromDB(item.resultId);
            imgTag = `<img src="${base64 || ''}">`;
        } else {
            imgTag = `<div class="anim-empty-frame"><span>🖼️</span> ОЖИДАНИЕ...</div>`;
        }
        
        const isProcessing = state.animAssembly.isRunning && 
                             state.animAssembly.queue.length > 0 && 
                             state.animAssembly.queue[state.animAssembly.currentIdx - 1]?.index === i;
        
        const isDone = item.isGrokDone;

        html += `
            <div class="animation-row" id="anim-row-${i}" style="${isProcessing ? 'border-color: var(--accent-grok); background: rgba(236, 72, 153, 0.05);' : (isDone ? 'opacity: 0.7; background: #111;' : '')}">
                <div class="anim-index">${i + 1}</div>
                <div class="anim-prompt-text" style="${!item.resultId ? 'opacity: 0.3' : ''}">${item.text}</div>
                <div class="anim-frame-container" id="anim-frame-${i}">
                    ${imgTag}
                </div>
                <div class="anim-status-container" style="display:flex; justify-content:center; align-items:center; gap:20px;">
                    <label class="custom-checkbox-label" style="cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:bold; color: ${isDone ? 'var(--accent-primary)' : 'var(--text-dim)'}">
                        <input type="checkbox" style="width:20px; height:20px; cursor:pointer;" 
                               ${isDone ? 'checked' : ''} 
                               ${!item.resultId ? 'disabled' : ''}
                               onchange="toggleAnimDone(${i}, this.checked)">
                        ${isDone ? '✅ СКАЧАНО' : 'Ожидает'}
                    </label>
                </div>
            </div>
        `;
    }

    container.innerHTML = html || `<p style="text-align: center; color: var(--text-dim);">Нет активных анимаций.</p>`;
}

window.toggleAnimDone = (index, isDone) => {
    const project = getCurrentProject();
    if (project && project.promptsList[index]) {
        project.promptsList[index].isGrokDone = isDone;
        saveState();
        renderProjectAnimation();
    }
};

// --- GROK ANIMATION ORCHESTRATION ---
async function _startAnimationAssembly() {
    if (state.animAssembly.isRunning) {
        console.warn("⚠️ [DEBUG] Animation assembly is already running. Ignoring duplicate start.");
        return;
    }
    console.log("🚀 [START_ANIM] Функция _startAnimationAssembly вызвана!");
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        console.warn("⚠️ [DEBUG] Проект или промпты не найдены.");
        return alert("Добавьте хотя бы один промт!");
    }
    
    console.log("🚀 [DEBUG] Проект:", project.name, "Промтов всего:", project.promptsList.length);
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    // Build Queue using Synchronized Status (v1.3.7)
    state.animAssembly.queue = project.promptsList
        .map((p, idx) => ({ ...p, index: idx }))
        .filter(p => {
            const hasResult = !!p.resultId;
            const isDone = !!p.isGrokDone;
            console.log(`🔍 [DEBUG] Промт #${p.index + 1}: hasResult=${hasResult}, isGrokDone=${isDone}`);
            return hasResult && !isDone;
        });
    
    console.log("🚀 [DEBUG] Очередь анимации создана, длина:", state.animAssembly.queue.length);
    
    if (state.animAssembly.queue.length === 0) {
        return alert("Нет новых кадров для анимации, либо все уже отмечены галочками!");
    }
    
    state.animAssembly.currentIdx = 0;
    state.animAssembly.isRunning = true;
    state.animAssembly.lockedProjectId = state.activeProjectId;
    
    document.getElementById('btn-start-anim').style.display = 'none';
    document.getElementById('btn-stop-anim').style.display = 'block';
    
    logStatus(`🚀 Сборка анимации запущена (${state.animAssembly.queue.length} кадров).`, "success");
    processNextAnimation();
}

function _stopAnimationAssembly(isManual = true) {
    state.animAssembly.isRunning = false;
    document.getElementById('btn-start-anim').style.display = 'block';
    document.getElementById('btn-stop-anim').style.display = 'none';
    
    if (isManual) logStatus("🛑 Сборка анимации остановлена.", "error");
    renderProjectAnimation();
}

async function animateSingleFrame(index) {
    if (state.animAssembly.isRunning) {
        if (!confirm("Сейчас идет общая сборка. Остановить и анимировать этот единственный кадр?")) return;
        stopAnimationAssembly(false);
    }
    
    const project = getCurrentProject();
    if (!project || !project.promptsList || !project.promptsList[index]) return;
    
    const item = project.promptsList[index];
    if (!item.resultId) return alert("Сначала сгенерируйте статичный кадр!");
    
    state.animAssembly.queue = [{
        index: index,
        text: item.text,
        resultId: item.resultId
    }];
    state.animAssembly.currentIdx = 0;
    state.animAssembly.isRunning = true;
    state.animAssembly.lockedProjectId = state.activeProjectId;
    
    document.getElementById('btn-start-anim').style.display = 'none';
    document.getElementById('btn-stop-anim').style.display = 'block';
    
    logStatus(`🚀 Одиночная анимация кадра #${index + 1} запущена.`, "info");
    processNextAnimation();
}

async function processNextAnimation() {
    if (!state.animAssembly.isRunning) return;

    if (state.animAssembly.currentIdx >= state.animAssembly.queue.length) {
        logStatus("✅ Пакетная анимация завершена!", "success");
        stopAnimationAssembly(false);
        return;
    }
    
    renderProjectAnimation(); // Update UI highlight
    
    const item = state.animAssembly.queue[state.animAssembly.currentIdx];
    
    // Apply prefix mapping
    const folder = getFolderForProject(state.activeProjectId);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    const fullPrompt = item.text.includes(prefix) ? item.text : (prefix.trim() + "\n\n" + item.text.trim()).trim();

    logStatus(`🚀 [Анимация ${state.animAssembly.currentIdx + 1}/${state.animAssembly.queue.length}] Отправка в Grok...`, "info");
    
    console.log("🔍 [DEBUG] Копирую текст промта в буфер...");
    // Explicit clipboard copy for prompt
    await copyTextToClipboard(fullPrompt);
    
    console.log("🔍 [DEBUG] Загрузка изображения для кадра:", item.resultId);
    const base64 = await getImageFromDB(item.resultId);
    console.log("✅ [DEBUG] Изображение загружено, размер:", base64 ? base64.length : 0);
    
    // Connection watchdog (20s — enough time for Grok page redirect ~6s + load)
    let bridgeResponded = false;
    const watchdog = setTimeout(() => {
        if (!bridgeResponded) {
            logStatus("⚠️ Ошибка: Расширение не ответило за 20 сек! Проверьте, обновлена ли эта страница (F5) и включено ли расширение.", "error");
            stopAnimationAssembly(true);
        }
    }, 20000);

    // One-time listener to disable watchdog
    const listener = (event) => {
        if (event.data?.type === "ANIMTUBE_STATUS") {
            bridgeResponded = true;
            clearTimeout(watchdog);
            window.removeEventListener("message", listener);
        }
    };
    window.addEventListener("message", listener);

    sendToBridge({
        type: "ANIMTUBE_GROK_AUTO_COMMAND", // Unique type to avoid conflicts
        msgId: Date.now() + "-" + Math.random(), // Unique ID for deduplication
        prompt: fullPrompt,
        assets: [base64], // Send the actual base64 to be pasted
        assetIds: [`anim-frame-${item.index}`] // ID for visual copy trigger
    });
}

function triggerAnimVisualCopy(cardId) {
    // This expects the extension to call ANIMTUBE_CMD_VISUAL_COPY but with targeted ID
    runVisualCopyAnimation([cardId]); 
}

// Replaced with simplified Grok Done handler
async function handleIncomingAnimation(base64) {
    console.log("Legacy handler called, ignored");
}

window._grokDoneLock = false;

window.handleGrokDone = async () => {
    const targetId = state.animAssembly.isRunning ? state.animAssembly.lockedProjectId : state.activeProjectId;
    const project = state.projects.find(p => p.id == targetId);
    if (!project) {
        console.error("[GrokDone] Project not found! targetId:", targetId);
        window._grokDoneLock = false;
        return;
    }
    
    const currentItem = state.animAssembly.queue[state.animAssembly.currentIdx];
    if (!currentItem) {
        console.error("[GrokDone] No item at currentIdx:", state.animAssembly.currentIdx);
        window._grokDoneLock = false;
        return;
    }
    
    // Update the specific prompt status (1-to-1 sync)
    const originalPrompt = project.promptsList[currentItem.index];
    if (originalPrompt) {
        originalPrompt.isGrokDone = true;
    }
    
    // Also cross-link with results library for UI consistency
    const resultFrame = project.results?.find(r => r.id == currentItem.resultId);
    if (resultFrame) {
        resultFrame.isGrokDone = true;
    }
    
    saveState();
    logStatus(`🎉 Анимация кадра #${currentItem.index + 1} успешно скачана!`, "success");
    
    state.animAssembly.currentIdx++;
    renderProjectAnimation();
    
    if (state.animAssembly.isRunning) {
        logStatus("⏳ Пауза 5 сек перед следующим кадром...", "info");
        // Release the lock after 3s — long enough to block any late duplicate signal
        setTimeout(() => { window._grokDoneLock = false; }, 3000);
        setTimeout(processNextAnimation, 5000);
    } else {
        window._grokDoneLock = false;
    }
};


function recreateSinglePrompt(index) {
    const project = getCurrentProject();
    if (!project || !project.promptsList || !project.promptsList[index]) return;
    
    // Safety: don't start if already running something else
    if (state.assembly.isRunning) {
        if (!confirm("Сейчас идет сборка. Остановить и пересоздать этот кадр?")) return;
        stopRollAssembly(false);
    }
    
    const item = project.promptsList[index];
    if (!item.text || item.text.trim().length < 2) return alert("Промт слишком короткий!");

    // Setup mini-assembly (1-to-1 refactor)
    state.assembly.queue = [{
        ...item,
        originalIndex: index
    }];
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    state.assembly.lockedProjectId = state.activeProjectId;
    
    // UI state
    document.getElementById('btn-start-assembly').style.display = 'none';
    document.getElementById('btn-stop-assembly').style.display = 'flex';
    document.getElementById('receiving-slot-panel').style.display = 'block';
    
    logStatus(`🔄 Пересоздание кадра #${index + 1}...`, "info");
    renderProjectPrompts();
    processNextItem();
}

function addPromptToProject() {
    const project = getCurrentProject();
    if (!project) return;
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    project.promptsList.push({
        text: prefix,
        isGeminiDone: false,
        isGrokDone: false,
        resultId: null
    });
    saveState();
    renderProjectPrompts();
}

function updatePromptValue(index, value) {
    const project = getCurrentProject();
    if (project && project.promptsList[index]) {
        project.promptsList[index].text = value;
        saveState();
    }
}

function deletePromptFromProject(index) {
    const project = getCurrentProject();
    if (project && project.promptsList) {
        project.promptsList.splice(index, 1);
        saveState();
        renderProjectPrompts();
    }
}

// --- SUPER AUTOMATION (v1.3.1) ---
function openSuperAutoModal() {
    document.getElementById('super-auto-overlay').style.display = 'flex';
}

function closeSuperAutoModal() {
    document.getElementById('super-auto-overlay').style.display = 'none';
}

function startSuperAutomation() {
    const countInput = document.getElementById('super-auto-count');
    const count = parseInt(countInput.value) || 1;
    
    closeSuperAutoModal();
    
    state.assembly.superAuto.active = true;
    state.assembly.superAuto.count = count;
    state.assembly.superAuto.phase = 'scripts';
    state.assembly.superAuto.splittingIdx = 0;
    
    document.getElementById('btn-super-auto').classList.add('active');
    
    logStatus(`🚀 ЗАПУСК СУПЕР-АВТОМАТИЗАЦИИ: ${count} видеороликов.`, "success");
    
    // Phase 1: Generated Scripts
    showPage('workspace');
    switchProjectTab('script');
    
    const scriptCountInput = document.getElementById('script-count');
    if (scriptCountInput) scriptCountInput.value = count;
    
    // Explicitly trigger generation
    setTimeout(() => {
        startScriptGeneration();
    }, 300);
}

function stopSuperAutomation() {
    state.assembly.superAuto.active = false;
    state.assembly.superAuto.phase = 'idle';
    document.getElementById('btn-super-auto').classList.remove('active');
    logStatus("🎊 Супер-автоматизация успешно завершена!", "success");
}

async function copyTextToClipboard(text) {
    // 1. Try Modern API
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {
        console.warn("Clipboard API failed, using fallback.");
    }

    // 2. Fallback: Hidden Textarea
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch (err) {
        console.error("Fallback copy failed:", err);
        return false;
    }
}

window.forceSync = async function() {
    const icon = document.getElementById('sync-icon');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    
    logStatus("🔄 Принудительная синхронизация...", "info");
    
    try {
        await detectIP();
        cloudDB = getDB();
        
        // If owner, push everything to cloud first
        if (authState.user.role === 'owner') {
            logStatus("📤 Выгрузка данных в облако...", "info");
            await saveState();
        }
        
        await loadState();
        logStatus("✅ Соединение восстановлено и данные синхронизированы.", "success");
    } catch (err) {
        logStatus("❌ Ошибка при синхронизации: " + err.message, "error");
        alert("🔴 ОШИБКА СИНХРОНИЗАЦИИ: " + err.message);
    } finally {
        if (icon) icon.style.animation = 'none';
    }
};

// Add spinning animation to style.css if missing
if (!document.getElementById('sync-anim-style')) {
    const s = document.createElement('style');
    s.id = 'sync-anim-style';
    s.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
}

// --- PARTNERS & SOCIAL LOGIC (NEW) ---
window.renderPartnersPage = async function() {
    const container = document.getElementById('partners-list-grid');
    if (!container) return;
    
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--accent-primary); font-weight: 700;">📡 Поиск партнёров в сети...</div>`;
    
    try {
        if (!cloudDB) cloudDB = getDB();
        
        // Subscribe to changes if channel/folders change
        if (!chatState.subscription) {
            chatState.subscription = cloudDB.channel('folders_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const idx = state.folders.findIndex(f => f.id == payload.new.id);
                    if (idx === -1) state.folders.push(payload.new);
                    else state.folders[idx] = { ...state.folders[idx], ...payload.new };
                } else if (payload.eventType === 'DELETE') {
                    state.folders = state.folders.filter(f => f.id != payload.old.id);
                }
                renderAccountPage();
                renderProjects();
                if (state.activePage === 'partners') renderPartnersPage();
            }).subscribe();
        }

        // 1. Fetch ALL Folders to calculate views (only if not already loaded in state)
        let allFolders = [];
        if (authState.user.role === 'manager' && state.folders.length > 0) {
            allFolders = state.folders;
        } else {
            const { data, error } = await cloudDB.from('folders').select('ownedby, assignedto, views');
            if (error) console.error("Stats Fetch Error:", error);
            allFolders = data || [];
        }
        
        const viewStats = {};
        if (allFolders) {
            allFolders.forEach(f => {
                const holders = (f.assignedto || f.ownedby || "").split(',').map(s => s.trim().toLowerCase());
                holders.forEach(h => { if (h) viewStats[h] = (viewStats[h] || 0) + (Number(f.views) || 0); });
            });
        }

        // 2. Use cached avatars or fetch once
        if (Object.keys(state.userAvatars).length === 0) {
             const { data: allAvatars } = await cloudDB.from('user_avatars').select('*');
             if (allAvatars) allAvatars.forEach(a => { if(a.login) state.userAvatars[a.login.toLowerCase()] = a.avatar; });
        }

        // 3. Render Whitelist Users
        container.innerHTML = WHITELIST.map(u => {
            const loginLower = u.login.toLowerCase();
            const views = viewStats[loginLower] || 0;
            const avatar = state.userAvatars[loginLower] || state.userAvatars[u.login]; // Try both case-insensitive and exact
            const initials = u.login.substring(0, 2).toUpperCase();
            
            return `
                <div class="partner-card" onclick="openPartnerProfile('${u.login}')">
                    <div class="avatar">
                        ${avatar ? `<img src="${avatar}">` : `<div style="font-size:32px; font-weight:900; color:white;">${initials}</div>`}
                    </div>

                    <div class="name">${u.login}</div>
                    <div class="stats">👁️ ${views.toLocaleString()} просмотров</div>

                    <div class="badge-online">Online</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Partners Load Error:", err);
        container.innerHTML = `<p style="color: var(--accent-primary);">Ошибка загрузки партнёров.</p>`;
    }
}

window.openPartnerProfile = async function(login) {
    const overlay = document.getElementById('partner-profile-overlay');
    const nameEl = document.getElementById('partner-profile-name');
    const viewsEl = document.getElementById('partner-total-views');
    const imgEl = document.getElementById('partner-profile-img');
    const initialsEl = document.getElementById('partner-profile-initials');
    const projectsGrid = document.getElementById('partner-projects-grid');
    
    if (!overlay) return;
    
    // Reset
    nameEl.innerText = login;
    projectsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--accent-primary);">📂 Загрузка проектов...</div>`;
    overlay.classList.add('active');

    try {
        if (!cloudDB) cloudDB = getDB();
        
        // 1. Load Stats
        const targetUser = WHITELIST.find(u => u.login === login);
        const isTargetOwner = targetUser && targetUser.role === 'owner';
        
        let query = cloudDB.from('folders').select('*');
        if (isTargetOwner) {
            // For owners: show only their UNASSIGNED channels to keep the view clean
            query = query.eq('ownedby', login).is('assignedto', null);
        } else {
            query = query.or(`assignedto.ilike.%${login}%,ownedby.eq."${login}"`);
        }
        
        const { data: userFolders } = await query;
        const totalViews = userFolders ? userFolders.reduce((sum, f) => sum + (Number(f.views) || 0), 0) : 0;
        viewsEl.innerText = `👁️ ${totalViews.toLocaleString()} просмотров`;

        // 2. Load Avatar
        let avatar = state.userAvatars[login.toLowerCase()] || state.userAvatars[login];
        if (!avatar) {
            const { data: avatarData } = await cloudDB.from('user_avatars').select('avatar').eq('login', login).maybeSingle();
            if (avatarData) avatar = avatarData.avatar;
        }
        
        if (avatar) {
            imgEl.src = avatar;
            imgEl.style.display = 'block';
            initialsEl.style.display = 'none';
        } else {
            imgEl.style.display = 'none';
            initialsEl.style.display = 'flex';
            initialsEl.innerText = login.substring(0, 2).toUpperCase();
        }

        // 3. Load Channels (Folders)
        if (!userFolders || userFolders.length === 0) {
            projectsGrid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color: var(--text-dim);">У этого креатора пока нет активных каналов.</p>`;
        } else {
            const isAuthorized = authState.user.role === 'owner' || authState.user.role === 'manager';
            projectsGrid.innerHTML = userFolders.map(f => `
                <div class="project-card" style="cursor: default; padding: 18px; background: rgba(255,255,255,0.03); border-radius: 20px; display: flex; align-items: center; gap: 18px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease;">
                    <div class="folder-avatar" style="width: 64px; height: 64px; border-radius: 16px; overflow: hidden; background: ${f.color || 'var(--accent-primary)'}; box-shadow: 0 8px 16px rgba(0,0,0,0.3); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        ${f.avatar ? `<img src="${f.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 28px;">📺</span>`}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 18px; color: white; letter-spacing: -0.5px;">${f.name}</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                            <span>👁️ ${(Number(f.views) || 0).toLocaleString()}</span>
                            <span style="opacity: 0.3;">•</span>
                            <span>👥 ${(Number(f.subscribers) || 0).toLocaleString()}</span>
                            <span style="opacity: 0.3;">•</span>
                            <span>${f.niche || 'General'}</span>
                        </div>
                    </div>
                    ${isAuthorized ? 
                        `<button onclick="enterChannel(${f.id})" class="btn btn-primary" style="padding: 8px 16px; font-size: 11px; background: var(--accent-primary); box-shadow: 0 4px 10px rgba(239,68,68,0.3);">УПРАВЛЯТЬ</button>` : 
                        `<div style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px; border: 1px solid rgba(239, 68, 68, 0.2);">LOCKED</div>`
                    }
                </div>
            `).join('');
        }
        
        // v5.1: Removed Chat Button from profile overlay

    } catch (err) {
        console.error("Profile Load Error:", err);
    }
}

async function enterChannel(folderId) {
    try {
        logStatus("🛰️ Вход в канал и синхронизация проектов...", "info");
        closePartnerProfile();
        
        if (!cloudDB) cloudDB = getDB();
        
        // 1. Fetch the target folder definition
        const { data: folder, error: fErr } = await cloudDB.from('folders').select('*').eq('id', folderId).single();
        if (fErr || !folder) throw new Error("Folder not found in cloud");
        
        // Ensure folder exists in local state
        const fIdx = state.folders.findIndex(f => f.id === folderId);
        if (fIdx === -1) state.folders.push(folder);
        else state.folders[fIdx] = folder;
        
        // 2. Fetch all projects belonging to this folder
        const { data: projects, error: pErr } = await cloudDB.from('projects').select('*').eq('folderid', folderId);
        if (pErr) throw pErr;
        
        // 3. Merge projects into local state (Cloud Priority)
        if (projects) {
            projects.forEach(p => {
                // Unpack 'data' field
                const unpacked = p.data ? { ...p, ...p.data } : p;
                
                const pIdx = state.projects.findIndex(sp => sp.id === p.id);
                if (pIdx === -1) {
                    state.projects.push(unpacked);
                } else {
                    // Update existing with cloud data
                    state.projects[pIdx] = { ...state.projects[pIdx], ...unpacked };
                }
            });
        }
        
        // 4. Set context and Switch Page
        state.currentFolderId = folderId;
        showPage('videos');
        
        logStatus(`✅ Синхронизация завершена. Вы управляете каналом: ${folder.name}`, "success");
        
    } catch (err) {
        console.error("Enter Channel Error:", err);
        logStatus("❌ Ошибка входа в канал: " + err.message, "error");
    }
}

window.closePartnerProfile = function() {
    document.getElementById('partner-profile-overlay').classList.remove('active');
}


window.enterChannel = enterChannel;

// --- CHAT SYSTEM (v2.0) ---
let chatState = {
    activeRecipient: null,
    messages: [],
    conversations: [],
    subscription: null
};


// Initialize Real-time if already logged in
if (authState.isLoggedIn) {
    // v2.1: CRITICAL STARTUP SYNC
    // Always load fresh cloud state and then start listening
    setTimeout(async () => {
        await loadState();
        setupRealtimeSync();
    }, 500);
}

// --- CACHE MANAGEMENT ---
window.clearLocalCache = function() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('animtube_'));
    
    if (keys.length === 0) {
        logStatus('✅ Кэш уже пустой — нечего удалять.', 'success');
        return;
    }

    let totalBytes = 0;
    keys.forEach(k => { totalBytes += (localStorage.getItem(k) || '').length * 2; });
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

    if (!confirm(`🗑️ Очистить кэш браузера?\n\nБудет удалено ${keys.length} записей (≈${totalMB} МБ).\n\n⚠️ Облачные данные (Supabase) НЕ затрагиваются — всё восстановится из облака при следующей загрузке.`)) return;

    keys.forEach(k => localStorage.removeItem(k));
    logStatus(`✅ Кэш очищен! Освобождено ≈${totalMB} МБ. Перезагружаю данные из облака...`, 'success');

    setTimeout(async () => {
        if (cloudDB && authState.isLoggedIn) {
            await loadState();
            if (state.activePage === 'account') renderAccountPage();
            logStatus('☁️ Данные успешно загружены из облака.', 'success');
        }
    }, 800);
};
