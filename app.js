/**
 * AnimTube v1.1 - BULK & DELETE Support
 * Sequence: Text First -> Website Return -> Visual Copy -> ChatGPT Send
 */

let db = null;

// --- SECURITY CONFIG & STATE ---
const WHITELIST = [
    { login: "Denis", pass: "Ub1dFnfCFUzVRDv", code: "529952203893", role: "owner", ip: "*" }, // Owner allows all IPs for testing
	{ login: "Alexander", pass: "0gX1t39fZMA2HY7", code: "984377574594", role: "partner", ip: "*" }, // Example partner
	{ login: "Alexander", pass: "k8ocT1wRnkhMQij", code: "681523913214", role: "partner", ip: "91.132.162.219" }, // Example partner
    { login: "Alexey", pass: "JAh92C36h3MkiMk", code: "255681851403", role: "partner", ip: "90.151.146.205" }, // Example partner
    { login: "Andrey", pass: "sbduB1HtwgQeFav", code: "743088149512", role: "manager", ip: "130.49.89.192" } // Test Manager
];

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
        if (authState.user.role === 'partner') {
            startPartnerTimer();
        }
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
        
        applySecurityUI();
        document.getElementById('auth-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('auth-overlay').style.display = 'none';
            if (user.role === 'partner') startPartnerTimer();
        }, 500);
        logStatus(`👋 Добро пожаловать, ${user.login}!`, "success");
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
}

function renderSidebarProfile() {
    const user = authState.user;
    if (!user) return;

    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const avatarEl = document.getElementById('user-avatar-letter');
    
    if (nameEl) nameEl.innerText = user.login;
    if (roleEl) {
        const roleLabels = { 'owner': '👑 ВЛАДЕЛЬЦУ', 'partner': '🤝 ПАРТНЁРУ', 'manager': '📊 МЕНЕДЖЕРУ' };
        roleEl.innerText = roleLabels[user.role] || user.role.toUpperCase();
    }
    
    if (avatarEl) {
        const userAvatar = state.userAvatars[user.login];
        if (userAvatar) {
            avatarEl.innerHTML = `<img src="${userAvatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            avatarEl.style.background = 'transparent';
        } else {
            avatarEl.innerText = user.login.substring(0, 2).toUpperCase();
            const roleColors = { 'owner': '#6366f1', 'partner': '#10b981', 'manager': '#f59e0b' };
            avatarEl.style.background = roleColors[user.role] || 'var(--accent-primary)';
        }
    }
}
    if (authState.user.role === 'partner' || authState.user.role === 'manager') {
        document.getElementById('partner-hud').style.display = 'flex';
    } else {
        document.getElementById('partner-hud').style.display = 'none';
    }
}

function startPartnerTimer() {
    if (authState.user.role !== 'partner' && authState.user.role !== 'manager') return;
    
    const today = new Date().toLocaleDateString();
    let usage = JSON.parse(localStorage.getItem('animtube_usage') || '{}');
    if (!usage[today]) usage[today] = 0; // seconds

    const MAX_SECONDS = 3 * 60 * 60; // 3 hours

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
            alert("⏰ Ваше время на сегодня закончилось (3 часа). Доступ заблокирован.");
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
window.createNewFolder = createNewFolder;

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
        queue: [],
        lockedProjectId: null
    },
    isAutoMode: JSON.parse(localStorage.getItem('animtube_auto_mode') || 'false')
};

const DEFAULT_PREFIX = "Create an image that closely resembles the style of the Peppa Pig cartoon, using the settings and art style of the Peppa Pig animated series: No text and a 1920×1080 frame. ";

// --- EXTENSION ROUTING (v1.3.2) ---
function sendToBridge(msg) {
    // If Super Automation is active, route to the "Auto" extension version
    const isAutoAnimation = state.animAssembly && state.animAssembly.isRunning;
    const isSuperAuto = state.assembly.superAuto && state.assembly.superAuto.active;
    
    if (isAutoAnimation || isSuperAuto) {
        if (msg.type === "ANIMTUBE_CMD") msg.type = "ANIMTUBE_AUTO_CMD";
        else if (msg.type === "ANIMTUBE_CMD_SCRIPT") msg.type = "ANIMTUBE_AUTO_CMD_SCRIPT";
        else if (msg.type === "ANIMTUBE_CMD_SPLIT") msg.type = "ANIMTUBE_AUTO_CMD_SPLIT";
        else if (msg.type === "TO_GROK") msg.type = "AUTO_TO_GROK";
        else if (msg.type === "TO_CHATGPT") msg.type = "AUTO_TO_CHATGPT";
        else if (msg.type === "TO_GEMINI") msg.type = "AUTO_TO_GEMINI";
    }
    window.postMessage(msg, "*");
}

// --- INITIALIZE ---
window.onload = async () => {
    await initDB();
    await detectIP();
    checkSecurity();

    renderProjects();
    setupGlobalListeners();
    updateAutoModeUI();
    console.log("🚀 AnimTube v1.2 loaded.");
    logStatus("✨ AnimTube v1.2 Ready.", "success");
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
            const scriptStatus = document.getElementById('script-receiving-text');
            if (scriptStatus) scriptStatus.innerText = event.data.text.toUpperCase();
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
            // Guard against double processing if both extensions are active
            if (state.animAssembly.lastProcessedIndex === state.animAssembly.currentIdx) return;
            state.animAssembly.lastProcessedIndex = state.animAssembly.currentIdx;
            
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
    saveState();
    renderProjectScripts();

    logStatus("📝 Запуск генерации сценария в ChatGPT...", "info");
    sendToBridge({ 
        type: "ANIMTUBE_CMD_SCRIPT", 
        prefix: prefix 
    });
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
        logStatus("🤖 [СУПЕР-АВТО]: Все сценарии готовы! Перехожу к разделению...", "success");
        state.assembly.superAuto.phase = 'splitting';
        state.assembly.superAuto.splittingIdx = 0;
        
        setTimeout(() => {
            switchProjectTab('prompts');
            processSuperAutoSplitting();
        }, 2000);
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

        saveState();
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

    saveState();
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
    
    // Add new lines to the project's prompt list
    lines.forEach(line => {
        // Clean up markdown/noise
        const clean = line.replace(/^[:\s\-*]+/, '').trim();
        if (clean) {
            project.promptsList.push({
                text: clean,
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
                
                // End any automated splitting chains to avoid tab-jumping
                state.assembly.superAuto.active = false;
                state.assembly.superAuto.phase = 'idle';
            }, 1000);
        }, 500);
        return;
    }

    // Fallback: direct injection into project prompt list
    const project = getCurrentProject();
    if (!project) return;

    const lines = rawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5)
        .map(l => l.replace(/^(Prompt|Промт|Кадр)\s*\d*[:\s]*/i, '').trim());

    const newObjects = lines.map(l => ({
        text: l,
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
    saveState();
    renderProjectScripts();
}

async function initDB() {
    return new Promise((resolve, reject) => {
        // v1.3.1: Upgrade DB version to 2 for animations
        const request = indexedDB.open("AnimTubeDB", 2);
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
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["images"], "readonly");
        const store = transaction.objectStore("images");
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.base64);
        request.onerror = (e) => reject(e);
    });
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
        request.onerror = (e) => reject(e);
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
    if (pageId === 'assets') renderGlobalAssets();
    if (pageId === 'account') renderAccountPage();
    if (pageId === 'workspace') {
        renderProjectScripts();
        renderProjectLibrary();
        renderProjectAssets();
    }
}

function switchProjectTab(tabId) {
    // Navigation Guard
    const role = authState.user?.role;
    if (role === 'partner' && tabId === 'script') {
        logStatus("🚫 Создание сценариев доступно только владельцу (и менеджеру).", "error");
        return;
    }
    if (role === 'manager' && (tabId === 'frames' || tabId === 'animation')) {
        logStatus("🚫 Менеджеры не имеют доступа к генерации кадров и анимации.", "error");
        return;
    }

    // 1. Update Tab Buttons
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const tabItem = document.getElementById(`tab-${tabId}`);
    if (tabItem) tabItem.classList.add('active');

    // 2. Update Content Panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    if (tabId === 'script') {
        document.getElementById('tab-content-script').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectScripts();
    } else if (tabId === 'prompts') {
        document.getElementById('tab-content-prompts').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectScenariosForSplitting();
    } else if (tabId === 'frames') {
        document.getElementById('tab-content-frames').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'block';
        renderProjectPrompts();
    } else if (tabId === 'animation') {
        document.getElementById('tab-content-animation').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectAnimation();
    } else {
        // All other tabs show the "Locked" placeholder
        const lockedPane = document.getElementById('tab-content-locked');
        if (lockedPane) lockedPane.classList.add('active');
    }

    logStatus(`📂 Переход во вкладку: ${tabId}`, "info");
}

function getFolderForProject(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !project.folderId) return null;
    return state.folders.find(f => f.id === project.folderId);
}

// --- CHANNEL MANAGEMENT (v1.4) ---
let currentChannelAvatar = null;
let currentChannelColor = '#6366f1';

function createNewFolder() {
    if (authState.user.role !== 'owner') {
        alert("🚫 Создавать новые каналы может только Владелец.");
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

function handleChannelAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = e.target.result;
            currentChannelAvatar = imgUrl;
            document.getElementById('channel-avatar-preview').innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            
            // Extract dominant color
            extractDominantColor(imgUrl, (color) => {
                currentChannelColor = color;
                document.getElementById('channel-avatar-preview').style.borderColor = color;
                document.getElementById('channel-avatar-preview').style.boxShadow = `0 0 20px ${color}44`;
            });
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
let activeAvatarTarget = null; // null for self, or login for partner

function openAvatarModal(targetLogin = null) {
    activeAvatarTarget = targetLogin;
    const title = targetLogin ? `Аватар для ${targetLogin}` : "Ваш аватар";
    document.getElementById('avatar-modal-title').innerText = title;
    document.getElementById('avatar-upload-overlay').style.display = 'flex';
}

function closeAvatarModal() {
    document.getElementById('avatar-upload-overlay').style.display = 'none';
}

function handleUserAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            state.userAvatars[activeAvatarTarget || authState.user.login] = base64;
            saveState();
            renderAccountPage();
            renderSidebarProfile();
            closeAvatarModal();
            logStatus("✅ Аватар успешно обновлен!", "success");
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
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;

    state.activeFolderIdForSettings = id;
    
    document.getElementById('folder-settings-title').innerText = `⚙️ ${folder.name.toUpperCase()}`;
    document.getElementById('folder-prompt-prefix').value = folder.prefix || "";
    document.getElementById('folder-script-prefix').value = folder.scriptPrefix || "";
    document.getElementById('folder-split-prefix').value = folder.splitPrefix || "";
    
    document.getElementById('folder-settings-overlay').style.display = 'flex';
}

function closeFolderSettings() {
    document.getElementById('folder-settings-overlay').style.display = 'none';
    state.activeFolderIdForSettings = null;
}

function saveFolderSettings() {
    const id = state.activeFolderIdForSettings;
    const folder = state.folders.find(f => f.id === id);
    
    if (folder) {
        folder.prefix = document.getElementById('folder-prompt-prefix').value;
        folder.scriptPrefix = document.getElementById('folder-script-prefix').value;
        folder.splitPrefix = document.getElementById('folder-split-prefix').value;
        saveState();
        logStatus(`✅ Настройки папки "${folder.name}" сохранены.`, "success");
    }
    
    closeFolderSettings();
    renderProjects();
}

// --- PROJECT MANAGEMENT ---
function createNewProject() {
    if (!state.currentFolderId && authState.user.role !== 'owner') {
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

    // Determine "my" folders:
    // Owner sees ALL. Partners/managers see only their own (or unowned = owner's)
    const myFolders = user.role === 'owner'
        ? state.folders
        : state.folders.filter(f => f.ownedBy === user.login);

    const totalProjects = myFolders.reduce((acc, f) =>
        acc + state.projects.filter(p => p.folderId === f.id).length, 0
    );

    const folderCards = myFolders.map(f => {
        const projCount = state.projects.filter(p => p.folderId === f.id).length;
        const channelColor = f.color || 'var(--accent-primary)';
        return `
                <div class="project-card folder-card" onclick="exitFolder(); openFolder(${f.id}); showPage('videos');" style="cursor:pointer; position:relative; border-color: ${channelColor}44; padding: 24px; border-radius: 24px;">
                    <div class="folder-badge" style="background:${channelColor}">КАНАЛ</div>
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
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 32px;">
            <div>
                <h2 style="margin:0;">👤 Личный кабинет</h2>
                <p style="color: var(--text-secondary); margin-top: 6px;">Ваш профиль и персональные каналы AnimTube</p>
            </div>
            <button class="btn btn-secondary" onclick="showPage('videos')" style="padding: 10px 20px;">← Назад</button>
        </div>

        <!-- PROFILE CARD (Premium Design) -->
        <div class="glass-panel" style="display: grid; grid-template-columns: auto 1fr auto; gap: 40px; align-items: center; padding: 40px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.05); background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);">
            
            <!-- Avatar Section -->
            <div style="position: relative; flex-shrink: 0;">
                <div style="width: 120px; height: 120px; border-radius: 40px; overflow: hidden; border: 3px solid ${roleColor}66; box-shadow: 0 20px 40px ${roleColor}22; background: ${roleColor}11; display:flex; align-items:center; justify-content:center;">
                    ${state.userAvatars[user.login] ? `<img src="${state.userAvatars[user.login]}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:48px; font-weight:900; color:${roleColor}">${initials}</span>`}
                </div>
                <button class="btn-avatar-edit" onclick="openAvatarModal()" style="position: absolute; bottom: -10px; right: -10px; width: 40px; height: 40px; border-radius: 12px; background: white; color: black; border: none; font-size: 18px; cursor: pointer; box-shadow: 0 10px 20px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: transform 0.2s;" onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='scale(1)'">📸</button>
            </div>

            <!-- Info Section -->
            <div>
                <div style="display:flex; align-items:center; gap:20px; margin-bottom:12px;">
                    <h1 style="margin:0; font-size:36px; font-weight:900; letter-spacing:-1px;">${user.login}</h1>
                    <span style="background:${roleColor}22; color:${roleColor}; border:1px solid ${roleColor}44; padding:6px 18px; border-radius:12px; font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase;">${roleLabel}</span>
                </div>
                <div style="display:flex; gap:32px; opacity:0.7; font-size:13px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:800; color:var(--text-dim);">ЛОГИН:</span>
                        <span style="font-weight:700;">${user.login}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:800; color:var(--text-dim);">IP:</span>
                        <span style="font-weight:700; color:var(--accent-primary);">${userIP}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:800; color:var(--text-dim);">КОД:</span>
                        <span style="font-family:monospace; font-weight:700;">${code}</span>
                    </div>
                </div>
            </div>

            <!-- Profile Settings Button -->
            <div style="text-align: right;">
                 <div style="font-size: 11px; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px;">Последний вход</div>
                 <div style="font-size: 14px; font-weight: 600;">${sessionDate} <span style="opacity:0.5; font-weight:400;">в ${sessionTime}</span></div>
            </div>
        </div>

        <!-- MY CHANNELS -->
        <div style="margin-top:48px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h3 style="margin:0; font-size:20px; font-weight:800; letter-spacing:1px;">📺 МОИ КАНАЛЫ</h3>
                    <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">Папки с проектами, закреплённые за вашим аккаунтом</p>
                </div>
                <button class="btn btn-primary" onclick="createNewFolderForAccount()" style="padding:10px 20px;">
                    📁 Создать канал
                </button>
            </div>

            <div class="project-grid">
                ${folderCards}
                ${myFolders.length === 0 ? `
                    <div style="grid-column:1/-1; text-align:center; padding:80px 20px; color:var(--text-dim); border: 2px dashed var(--border-glass); border-radius: 24px;">
                        <div style="font-size:60px; margin-bottom:20px;">📫</div>
                        <h3 style="color:var(--text-secondary); margin-bottom:8px;">У вас пока нет каналов</h3>
                        <p>Нажмите «Создать канал», чтобы начать!</p>
                    </div>
                ` : ''}
            </div>
        </div>
        <!-- PARTNER MANAGEMENT (Owner Only) -->
        ${user.role === 'owner' ? `
        <div style="margin-top:64px; padding-top:48px; border-top:1px solid var(--border-glass);">
            <div style="margin-bottom:32px;">
                <h3 style="margin:0; font-size:20px; font-weight:800; letter-spacing:1px;">👥 УПРАВЛЕНИЕ ПАРТНЁРАМИ</h3>
                <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">Назначьте каналы вашим сотрудникам для ведения.</p>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap:32px;">
                ${WHITELIST.filter(u => u.role !== 'owner').map(u => {
                    const assigned = state.folders.filter(f => f.assignedTo === u.login);
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
                                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.05);">
                                            <div style="display:flex; align-items:center; gap:12px;">
                                                <div style="width:28px; height:28px; border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                                                    ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:12px; display:flex; align-items:center; justify-content:center; height:100%;">📺</span>'}
                                                </div>
                                                <span style="font-size:14px; font-weight:700;">${f.name}</span>
                                            </div>
                                            <button class="btn-del-mini" onclick="unassignFolder(${f.id})" title="Отвязать канал" style="opacity:0.4; transition:opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'">×</button>
                                        </div>
                                    `).join('') : '<div style="color:var(--text-dim); font-size:13px; font-style:italic; padding:10px; text-align:center;">Нет назначенных каналов</div>'}
                                </div>
                            </div>

                            <div style="margin-top:24px;">
                                <select onchange="assignFolderToUser(this.value, '${u.login}')" style="width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:14px; color:white; font-size:12px; font-weight:700; outline:none; cursor:pointer; transition:all 0.2s; appearance:none;" onfocus="this.style.borderColor='var(--accent-primary)'; this.style.background='rgba(255,255,255,0.05)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.03)';">
                                    <option value="" style="background:#0a0a0c;">+ ПРИВЯЗАТЬ НОВЫЙ КАНАЛ...</option>
                                    ${state.folders.filter(f => !f.assignedTo).map(f => `
                                        <option value="${f.id}">${f.name}</option>
                                    `).join('')}
                                </select>
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
function assignFolderToUser(folderId, userLogin) {
    if (!folderId) return;
    const folder = state.folders.find(f => f.id == folderId);
    if (folder) {
        folder.assignedTo = userLogin;
        saveState();
        renderAccountPage();
        logStatus(`✅ Канал "${folder.name}" назначен пользователю ${userLogin}.`, "success");
    }
}

function unassignFolder(folderId) {
    const folder = state.folders.find(f => f.id == folderId);
    if (folder) {
        const prevUser = folder.assignedTo;
        folder.assignedTo = null;
        saveState();
        renderAccountPage();
        logStatus(`ℹ️ Канал "${folder.name}" отвязан от пользователя ${prevUser}.`, "info");
    }
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
    if (!container) return;

    container.innerHTML = "";

    // 1. Handle Navigation Header (Breadcrumbs)
    if (state.currentFolderId) {
        const folder = state.folders.find(f => f.id === state.currentFolderId);
        const folderName = folder ? folder.name : "Канал";
        
        if (description) description.innerHTML = `<span style="color:var(--accent-primary); cursor:pointer;" onclick="exitFolder()">Мои Каналы</span> / <b>${folderName}</b>`;
        
        // Add "Back" button as first item
        const backBtn = document.createElement('div');
        backBtn.className = "project-card folder-card";
        backBtn.onclick = exitFolder;
        backBtn.innerHTML = `
            <div class="folder-icon">⬅️</div>
            <div class="project-name">Назад</div>
        `;
        container.appendChild(backBtn);
    } else {
        if (description) description.innerText = "Управляйте своими анимационными каналами и проектами.";
    }

    // 2. Render Folders (only at root)
    if (!state.currentFolderId) {
        const visibleFolders = authState.user.role === 'owner' 
            ? state.folders 
            : state.folders.filter(f => f.assignedTo === authState.user.login);

        if (visibleFolders.length === 1 && authState.user.role !== 'owner') {
            const f = visibleFolders[0];
            const projectCount = state.projects.filter(p => p.folderId === f.id).length;
            const channelColor = f.color || 'var(--accent-primary)';
            
            container.innerHTML = `
                <div class="featured-channel-card" onclick="openFolder(${f.id})" style="grid-column: 1/-1; border-color: ${channelColor}; box-shadow: 0 30px 60px ${channelColor}22;">
                    <div class="channel-main-info" style="display:flex; align-items:center; gap:40px;">
                        <div style="width:180px; height:180px; border-radius:40px; overflow:hidden; border:4px solid ${channelColor}; flex-shrink:0; box-shadow: 0 0 30px ${channelColor}44;">
                            ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:${channelColor}22; display:flex; align-items:center; justify-content:center; font-size:60px;">📺</div>`}
                        </div>
                        <div>
                            <div class="folder-badge" style="background:${channelColor}; margin-bottom:15px; width:fit-content; position:static;">АКТИВНЫЙ КАНАЛ</div>
                            <h1 style="font-size: 48px; font-weight: 900; margin-bottom: 5px;">${f.name}</h1>
                            <div style="color:${channelColor}; font-weight:800; text-transform:uppercase; letter-spacing:2px; font-size:14px; margin-bottom:15px;">🚀 ${f.niche || 'Общая ниша'}</div>
                            <p style="color: var(--text-secondary); font-size: 16px;">${projectCount} активных проектов • Ведущий: ${authState.user.login}</p>
                        </div>
                    </div>
                    <div class="channel-actions">
                         <button class="btn btn-primary" style="background:${channelColor}; padding: 15px 40px; font-size: 16px; box-shadow: 0 10px 20px ${channelColor}44;">ОТКРЫТЬ СТУДИЮ →</button>
                         <button class="btn-folder-settings" onclick="event.stopPropagation(); openFolderSettings(${f.id})" style="position:static; width:50px; height:50px; font-size:24px;">⚙️</button>
                    </div>
                </div>
            `;
            return;
        }

        visibleFolders.forEach(f => {
            const projectCount = state.projects.filter(p => p.folderId === f.id).length;
            const channelColor = f.color || 'var(--accent-primary)';
            const card = document.createElement('div');
            card.className = "project-card folder-card";
            card.style.borderColor = `${channelColor}44`;
            card.onclick = () => openFolder(f.id);
            card.innerHTML = `
                <div class="folder-badge" style="background:${channelColor}">КАНАЛ</div>
                <button class="btn-folder-settings" onclick="event.stopPropagation(); openFolderSettings(${f.id})" title="Настройки промптов">⚙️</button>
                <div style="width:80px; height:80px; border-radius:20px; overflow:hidden; margin-bottom:10px; border:2px solid ${channelColor}44;">
                    ${f.avatar ? `<img src="${f.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:${channelColor}11; display:flex; align-items:center; justify-content:center; font-size:30px;">📂</div>`}
                </div>
                <div class="project-name">${f.name}</div>
                <div style="font-size:10px; font-weight:800; color:${channelColor}; text-transform:uppercase; letter-spacing:1px; margin-top:-8px;">${f.niche || '—'}</div>
                <div class="project-meta">${projectCount} проектов • ${f.created}</div>
                <button class="lib-del-btn role-owner-only" onclick="event.stopPropagation(); deleteFolder(${f.id})" style="top: 50px;">×</button>
            `;
            container.appendChild(card);
        });
    }

    // 3. Render Projects (filtered by current folder)
    const filteredProjects = state.projects.filter(p => p.folderId === state.currentFolderId);
    
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
        card.className = "project-card";
        card.onclick = () => openProject(p.id);
        card.innerHTML = `
            <button class="lib-del-btn" onclick="event.stopPropagation(); deleteProject(${p.id})">×</button>
            <button class="btn-move-project" title="Переместить" onclick="event.stopPropagation(); requestMoveProject(${p.id})">📦</button>
            <div class="folder-icon">🎬</div>
            <div class="project-name">${p.name}</div>
            <div class="project-meta">${p.results ? p.results.length : 0} кадров • ${p.created}</div>
        `;
        container.appendChild(card);
    });
}

function deleteFolder(id) {
    if (authState.user.role !== 'owner') {
        alert("🚫 Удалять каналы может только Владелец.");
        return;
    }
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;
    if (!confirm(`Удалить канал "${folder.name}"? Проекты внутри НЕ будут удалены, они переместятся в корень.`)) return;
    
    state.projects.forEach(p => {
        if (p.folderId === id) p.folderId = null;
    });
    
    state.folders = state.folders.filter(f => f.id !== id);
    saveState();
    renderProjects();
    logStatus(`🗑️ Канал "${folder.name}" удалён.`, "info");
}

function deleteProject(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    if (!confirm(`Удалить видео-проект "${project.name}"? Это действие необратимо!`)) return;

    state.projects = state.projects.filter(p => p.id !== id);
    saveState();
    renderProjects();
    logStatus(`🗑️ Проект "${project.name}" удален.`, "info");
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
    const project = state.projects.find(p => p.id === id);
    if (!project) return;

    state.activeProjectId = id;
    const nameEl = document.getElementById('current-project-name');
    if (nameEl) nameEl.innerText = project.name;
    
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
            }
        }

        // 3. Save Scripts/Scenarios
        if (project.scripts && project.scripts.length > 0) {
            logStatus(`📝 Сохраняю сценарии (${project.scripts.length})...`, "info");
            for (let i = 0; i < project.scripts.length; i++) {
                const s = project.scripts[i];
                const fileName = `Scenario_${project.name}_${s.scriptNum || (project.scripts.length - i)}.txt`;
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(s.text);
                await writable.close();
            }
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


function saveState() {
    localStorage.setItem('animtube_projects', JSON.stringify(state.projects));
    localStorage.setItem('animtube_folders', JSON.stringify(state.folders));
}

// --- BATCH GENERATION ---
async function startRollAssembly() {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }
    
    // DECAPPING: Filter only uncompleted prompts (v1.3.7)
    const queue = project.promptsList
        .map((p, idx) => ({ ...p, originalIndex: idx }))
        .filter(p => !p.isGeminiDone);
    
    if (queue.length === 0) {
        return alert("Все кадры в этом проекте уже помечены как готовые!");
    }

    state.assembly.queue = queue;
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    state.assembly.lockedProjectId = state.activeProjectId;
    
    document.getElementById('btn-start-assembly').style.display = 'none';
    document.getElementById('btn-stop-assembly').style.display = 'flex';
    document.getElementById('receiving-slot-panel').style.display = 'block';
    
    logStatus(`🎬 Пакетная сборка запущена (${queue.length} кадров).`, "info");
    processNextItem();
}

function stopRollAssembly(isManual = true) {
    state.assembly.isRunning = false;
    clearTimeout(state.assembly.timerId);
    document.getElementById('btn-start-assembly').style.display = 'flex';
    document.getElementById('btn-stop-assembly').style.display = 'none';
    
    if (isManual) {
        logStatus("🛑 Сборка остановлена.", "error");
    }
}

// --- GLOBAL ASSET LIBRARY (v11.1) ---
window.triggerGlobalAssetUpload = () => {
    const name = document.getElementById('global-asset-name').value.trim();
    if (!name) return alert("Введите имя ассета (напр. Пеппа)!");
    document.getElementById('global-asset-file').click();
};

window.handleAddGlobalAsset = async (input) => {
    const nameInput = document.getElementById('global-asset-name');
    const name = nameInput.value.trim();
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;
        const assetId = "asset_" + Date.now();
        
        const transaction = db.transaction(["assets"], "readwrite");
        transaction.objectStore("assets").put({ id: assetId, base64, name });

        nameInput.value = "";
        input.value = "";
        renderGlobalAssets();
        logStatus(`📦 Ассет "${name}" добавлен в глобальную библиотеку.`, "success");
    };
    reader.readAsDataURL(file);
};

async function renderGlobalAssets() {
    const container = document.getElementById('global-assets-list');
    if (!container) return;

    const transaction = db.transaction(["assets"], "readonly");
    const store = transaction.objectStore("assets");
    const request = store.getAll();

    request.onsuccess = () => {
        const assets = request.result;
        if (assets.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">Библиотека пуста. Добавьте первого героя или фон.</p>`;
            return;
        }

        container.innerHTML = assets.map(a => `
            <div class="lib-card" style="position: relative;">
                <img src="${a.base64}" class="lib-img">
                <div class="lib-info">
                    <div style="font-weight: 700; font-size: 14px;">${a.name}</div>
                </div>
                <button class="lib-del-btn" onclick="deleteGlobalAsset('${a.id}')">×</button>
            </div>
        `).join('');
    };
}

async function deleteGlobalAsset(id) {
    if (!confirm("Удалить этот ассет навсегда? Он исчезнет из всех проектов.")) return;
    const transaction = db.transaction(["assets"], "readwrite");
    transaction.objectStore("assets").delete(id);
    
    // Clean up project references
    state.projects.forEach(p => {
        if (p.assets) p.assets = p.assets.filter(a => a.id !== id);
    });
    saveState();
    renderGlobalAssets();
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
    const project = getCurrentProject();
    const container = document.getElementById('project-assets-selection');
    if (!project || !container) return;

    if (!project.assets || project.assets.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; font-size: 11px; color: var(--text-dim);">Ассеты не выбраны.</p>`;
        return;
    }

    container.innerHTML = "";
    for (const assetRef of project.assets) {
        const transaction = db.transaction(["assets"], "readonly");
        const request = transaction.objectStore("assets").get(assetRef.id);
        
        request.onsuccess = () => {
            const assetData = request.result;
            if (!assetData) return;
            
            const card = document.createElement('div');
            card.className = "lib-card";
            card.style.position = "relative";
            card.dataset.assetId = assetRef.id; 
            card.innerHTML = `
                <img src="${assetData.base64}" class="lib-img" style="height: 70px;">
                <div class="lib-info" style="padding: 5px;">
                    <div style="font-size: 10px; font-weight: 700;">${assetData.name}</div>
                </div>
                <div class="copy-badge">КОПИРУЮ...</div>
                <button class="lib-del-btn" onclick="toggleAssetForProject('${assetRef.id}', false)">×</button>
            `;
            container.appendChild(card);
        };
    }
}

// --- HELPER: RUSSIAN-FRIENDLY MATCHING v2 (v11.7) ---
function isAssetMatch(prompt, assetName) {
    if (!prompt || !assetName) return false;
    const p = prompt.toLowerCase();
    const n = assetName.toLowerCase().trim();
    
    // 1. Direct match
    if (p.includes(n)) return true;
    
    // 2. Advanced Stemming (v11.18 - Linguistic Mastery)
    // Strip multi-character Russian endings to find the root
    const endingsRegex = /(ий|ый|ой|ая|яя|ое|ее|ую|юю|ых|их|ими|ыми|ого|его|ому|ему|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|й|ь)$/;
    
    // Create a list of significant roots (min 3 chars)
    const roots = n.split(/\s+/).map(word => word.replace(endingsRegex, '')).filter(r => r.length >= 3);
    
    // Check if any significant root from the asset name is in the prompt
    for (const root of roots) {
        // Find root as start of a word or separate word
        const regex = new RegExp(root, 'i');
        if (regex.test(p)) return true;
    }
    
    return false;
}

async function processNextItem() {
    if (!state.assembly.isRunning) return;

    if (state.assembly.currentIdx >= state.assembly.queue.length) {
        logStatus("✅ Пакетная сборка завершена!", "success");
        stopRollAssembly(false);
        
        // AUTO-TRANSITION (v1.3.8)
        if (state.isAutoMode) {
            logStatus("⏳ [АВТО]: Переход к анимации через 5 секунд...", "info");
            setTimeout(() => {
                // Ensure we are still in auto mode and on the workspace page
                if (state.isAutoMode && state.activePage === 'workspace') {
                    switchProjectTab('animation');
                    logStatus("🎬 [АВТО]: Вкладка переключена. Запуск сборки...", "success");
                    
                    // Small delay to ensure tab is rendered and buttons are reachable
                    setTimeout(() => {
                        startAnimationAssembly();
                    }, 1000);
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
    
    const fullPrompt = rawPrompt.includes(prefix) ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
    
    // EXPLICIT CLIPBOARD COPY (v1.3.2 - Zero-Click Fix)
    await copyTextToClipboard(fullPrompt);
    logStatus(`📋 [Промт ${state.assembly.currentIdx + 1}]: Текст в буфере.`, "success");
    
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

     if (project && project.assets) {
        for (const assetRef of project.assets) {
            if (isAssetMatch(rawPrompt, assetRef.name)) {
                matchedNames.push(assetRef.name);
                matchedIds.push(assetRef.id);
                
                const transaction = db.transaction(["assets"], "readonly");
                const assetData = await new Promise(r => {
                    const req = transaction.objectStore("assets").get(assetRef.id);
                    req.onsuccess = () => r(req.result);
                });
                if (assetData) matchingAssets.push(assetData.base64);
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

    state.assembly.lastSentPrompt = fullPrompt;
    sendToBridge({ 
        type: "TO_GEMINI", 
        prompt: fullPrompt,
        assets: matchingAssets,
        assetIds: matchedIds // v11.16
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
    const project = state.projects.find(p => p.id === targetId);
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
    await saveImageToDB(imgId, base64);

    const result = {
        id: imgId,
        promptSnippet: state.assembly.lastSentPrompt || "User Image",
        time: new Date().toLocaleTimeString()
    };
    project.results.unshift(result);
    
    // 1-to-1 SYNC: Update the specific prompt status (v1.3.7)
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
        const imgData = await getImageFromDB(res.id);
        
        card.onclick = () => {
            const preview = document.getElementById('preview-frame');
            if (preview) {
                preview.src = imgData;
                preview.style.display = 'block';
                if (document.getElementById('canvas-empty')) document.getElementById('canvas-empty').style.display = 'none';
            }
        };

        card.innerHTML = `
            <img src="${imgData || ''}" class="lib-img">
            <div class="lib-info">
                <div class="lib-prompt">"${res.promptSnippet}"</div>
                <div style="font-size: 10px; opacity: 0.5; margin-top: 5px;">${res.time}</div>
            </div>
            <button class="lib-del-btn" onclick="event.stopPropagation(); deleteFrame('${res.id}')">×</button>
        `;
        container.appendChild(card);
    }
}

async function deleteFrame(id) {
    if (!confirm("Удалить кадр?")) return;
    const project = getCurrentProject();
    project.results = project.results.filter(r => r.id !== id);
    
    const transaction = db.transaction(["images"], "readwrite");
    transaction.objectStore("images").delete(id);
    
    saveState();
    renderProjectLibrary();
}

// --- UTILS ---
function getCurrentProject() {
    return state.projects.find(p => p.id === state.activeProjectId);
}

function logStatus(msg, type) {
    const terminal = document.getElementById('studio-terminal');
    if (!terminal) return;
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
                        <label class="custom-checkbox-label" style="cursor:pointer; display:flex; align-items:center; gap:8px; font-weight:bold; color: ${isDone ? 'var(--accent-gemini)' : 'var(--text-dim)'}; font-size: 10px;">
                            <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" 
                                   ${isDone ? 'checked' : ''} 
                                   onchange="toggleGeminiDone(${index}, this.checked)">
                            ${isDone ? '✅ КАДР ГОТОВ' : 'НЕ ГОТОВ'}
                        </label>
                    </div>
                </div>
                <textarea class="prompt-textarea" 
                          onchange="updatePromptValue(${index}, this.value)" 
                          placeholder="Опишите, что происходит в этом кадре...">${p.text}</textarea>
                <div class="prompt-actions">
                    <button class="prompt-btn prompt-btn-recreate" onclick="recreateSinglePrompt(${index})">
                        <span>🔄</span> Пересоздать
                    </button>
                    <button class="prompt-btn prompt-btn-del" onclick="deletePromptFromProject(${index})">
                        <span>🗑️</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

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

// --- ANIMATION RENDERER (v1.3.1) ---
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
async function startAnimationAssembly() {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }
    
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    // Build Queue using Synchronized Status (v1.3.7)
    state.animAssembly.queue = project.promptsList
        .map((p, idx) => ({ ...p, index: idx }))
        .filter(p => p.resultId && !p.isGrokDone);
    
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

function stopAnimationAssembly(isManual = true) {
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
    
    // Explicit clipboard copy for prompt
    await copyTextToClipboard(fullPrompt);
    
    const base64 = await getImageFromDB(item.resultId);
    
    // Connection watchdog
    let bridgeResponded = false;
    const watchdog = setTimeout(() => {
        if (!bridgeResponded) {
            logStatus("⚠️ Ошибка: Расширение не ответило! Проверьте, обновлена ли эта страница (F5) и включено ли расширение.", "error");
            stopAnimationAssembly(true);
        }
    }, 3000);

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
        type: "TO_GROK", // Custom command for extension
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

window.handleGrokDone = async () => {
    const targetId = state.animAssembly.isRunning ? state.animAssembly.lockedProjectId : state.activeProjectId;
    const project = state.projects.find(p => p.id === targetId);
    if (!project) return;
    
    const currentItem = state.animAssembly.queue[state.animAssembly.currentIdx];
    if (!currentItem) return;
    
    // Update the specific prompt status (1-to-1 sync)
    const originalPrompt = project.promptsList[currentItem.index];
    if (originalPrompt) {
        originalPrompt.isGrokDone = true;
    }
    
    // Also cross-link with results library for UI consistency
    const resultFrame = project.results.find(r => r.id === currentItem.resultId);
    if (resultFrame) {
        resultFrame.isGrokDone = true;
    }
    
    saveState();
    logStatus(`🎉 Анимация кадра #${currentItem.index + 1} успешно скачана!`, "success");
    
    state.animAssembly.currentIdx++;
    renderProjectAnimation();
    
    if (state.animAssembly.isRunning) {
        logStatus("⏳ Пауза 5 сек перед следующим кадром...", "info");
        setTimeout(processNextAnimation, 5000);
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
    if (!project.promptsList) project.promptsList = [];
    
    project.promptsList.push({
        text: "",
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
    switchProjectTab('script');
    const scriptCountInput = document.getElementById('script-count');
    if (scriptCountInput) scriptCountInput.value = count;
    
    startScriptGeneration();
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
