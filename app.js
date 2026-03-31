/**
 * AnimTube PRO v11.18 - LINGUISTIC MASTERY Engine
 * Sequence: Text First -> Website Return -> Visual Copy -> Gemini Send
 */

let db = null;

let state = {
    activePage: 'videos',
    keys: JSON.parse(localStorage.getItem('animtube_keys') || '{"gemini":"", "grok":"", "prefix":""}'),
    projects: JSON.parse(localStorage.getItem('animtube_projects') || '[]'),
    folders: JSON.parse(localStorage.getItem('animtube_folders') || '[]'),
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
        pendingImage: null // Store image while waiting for the final switch back
    }
};

const DEFAULT_PREFIX = "Create an image that closely resembles the style of the Peppa Pig cartoon, using the settings and art style of the Peppa Pig animated series: No text and a 1920×1080 frame. ";

// --- INITIALIZE ---
window.onload = async () => {
    await initDB();
    loadKeysData();
    renderProjects();
    setupGlobalListeners();
    console.log("🚀 AnimTube v11.18 Linguistic Mastery loaded.");
    logStatus("✨ AnimTube v11.18 Linguistic Mastery Ready.", "success");
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

        // 2. Image Arrival (Internal transfer from Gemini)
        if (event.data.type === "FROM_GEMINI") {
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
        if (event.data.type === "FROM_GEMINI_SCRIPT") {
            handleIncomingScript(event.data.text);
        }

        // 6. ROBOT STATUS UPDATE (General Relay)
        if (event.data.type === "ANIMTUBE_STATUS") {
            const scriptStatus = document.getElementById('script-receiving-text');
            if (scriptStatus) scriptStatus.innerText = event.data.text.toUpperCase();
        }
    });
}

// --- SCRIPT MANAGEMENT ---
function startScriptGeneration() {
    const project = getCurrentProject();
    if (!project) return;

    const folder = getFolderForProject(project.id);
    const prefix = folder ? folder.scriptPrefix : "Напиши сценарий для серии...";
    
    // UI: Create a PENDING script card at the TOP
    if (!project.scripts) project.scripts = [];
    const nextNum = project.scripts.length + 1;
    
    const pendingScript = {
        id: "pending-" + Date.now(),
        isPending: true,
        text: "Ожидание возврата робота из Gemini...",
        scriptNum: nextNum,
        created: new Date().toLocaleTimeString()
    };
    
    project.scripts.unshift(pendingScript);
    saveState();
    renderProjectScripts();

    logStatus("📝 Запуск генерации сценария в Gemini...", "info");
    window.postMessage({ 
        type: "ANIMTUBE_CMD_SCRIPT", 
        prefix: prefix 
    }, "*");
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
}

function renderProjectScripts() {
    const project = getCurrentProject();
    const container = document.getElementById('project-scripts-container');
    if (!project || !container) return;

    if (!project.scripts || project.scripts.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-dim); padding: 40px;">Сценарии еще не созданы. Нажмите кнопку выше, чтобы начать.</p>`;
        return;
    }

    container.innerHTML = sorted.map((s, idx) => {
        const scriptNum = s.scriptNum || (sorted.length - idx);
        const isCollapsed = s.isCollapsed ?? false; // Default expanded for single scenario
        const isPending = s.isPending;
        
        return `
        <div class="script-card ${isCollapsed ? 'collapsed' : 'expanded'} ${isPending ? 'pending' : ''}" id="script-card-${s.id}">
            <div class="script-header" onclick="toggleScript('${s.id}')">
                <span style="font-weight: 800; color: var(--accent-gemini);">СЦЕНАРИЙ #${scriptNum}</span>
                <span style="opacity: 0.5; font-size: 11px; margin-left: 10px;">${s.created}</span>
                <span id="script-status-${s.id}" style="margin-left: auto; font-size: 11px; font-weight: 800;">
                    ${isPending ? '⌛ ГЕНЕРАЦИЯ...' : '✅ ВСТАВЛЕН'}
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
                
                <div class="script-actions" style="margin-top: 15px;">
                    <button class="script-btn script-btn-copy" onclick="copyScriptToClipboard('${s.id}')">📋 Копировать</button>
                    <button class="script-btn script-btn-download" onclick="downloadScript('${s.id}')">📥 Скачать .txt</button>
                    <button class="script-btn script-btn-del" onclick="deleteScript('${s.id}')">🗑️ Удалить</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function updateScriptText(id, newText) {
    const project = getCurrentProject();
    const script = project.scripts.find(s => s.id == id);
    if (script) {
        script.text = newText;
        // Don't saveState on every char, maybe debounced, but let's keep it simple for now
        localStorage.setItem('animtube_state', JSON.stringify(appState));
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
        const request = indexedDB.open("AnimTubeDB", 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("images")) {
                db.createObjectStore("images", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("assets")) {
                db.createObjectStore("assets", { keyPath: "id" });
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

// --- NAVIGATION ---
function showPage(pageId) {
    state.activePage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    const navItem = document.getElementById(`nav-${pageId}`);
    if (navItem) navItem.classList.add('active');
    
    if (pageId === 'videos') renderProjects();
    if (pageId === 'assets') renderGlobalAssets();
    if (pageId === 'workspace') {
        renderProjectScripts();
        renderProjectLibrary();
        renderProjectAssets();
    }
}

function switchProjectTab(tabId) {
    // 1. Update Tab Buttons
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // 2. Update Content Panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    if (tabId === 'script') {
        document.getElementById('tab-content-script').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'none';
        renderProjectScripts();
    } else if (tabId === 'frames') {
        document.getElementById('tab-content-frames').classList.add('active');
        if (document.getElementById('project-settings-assets')) document.getElementById('project-settings-assets').style.display = 'block';
    } else {
        // All other tabs show the "Locked" placeholder
        document.getElementById('tab-content-locked').classList.add('active');
    }

    logStatus(`📂 Переход во вкладку: ${tabId}`, "info");
}

window.updateProjectScriptPrefix = (prefix) => {
    const project = getCurrentProject();
    if (project) {
        project.scriptPrefix = prefix;
        saveState();
        logStatus("✅ Префикс сценария обновлен.", "success");
    }
};

window.updateProjectPrefix = (prefix) => {
    // Legacy support or ignored. Prefixes are now folder-level.
};

function openFolderSettings(id, event) {
    if (event) event.stopPropagation();
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;

    state.editingFolderId = id;
    
    // Fill values
    document.getElementById('modal-script-prefix').value = folder.scriptPrefix || "Напиши сценарий для серии...";
    document.getElementById('modal-style-prefix').value = folder.prefix || DEFAULT_PREFIX;
    
    document.getElementById('folder-settings-overlay').classList.add('active');
}

function closeFolderSettings() {
    document.getElementById('folder-settings-overlay').classList.remove('active');
    state.editingFolderId = null;
}

function saveFolderSettings() {
    const id = state.editingFolderId;
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;

    folder.scriptPrefix = document.getElementById('modal-script-prefix').value;
    folder.prefix = document.getElementById('modal-style-prefix').value;
    
    saveState();
    closeFolderSettings();
    renderProjects();
    logStatus(`✅ Настройки папки "${folder.name}" сохранены.`, "success");
}

function getFolderForProject(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !project.folderId) return null;
    return state.folders.find(f => f.id === project.folderId);
}

// --- FOLDER MANAGEMENT ---
function createNewFolder() {
    const name = prompt("Введите название папки (Большого проекта):", "Новая папка");
    if (!name) return;

    const newFolder = {
        id: Date.now(),
        name: name,
        prefix: DEFAULT_PREFIX,
        scriptPrefix: "Напиши подробный сценарий для серии мультфильма про...",
        created: new Date().toLocaleDateString()
    };

    state.folders.unshift(newFolder);
    saveState();
    renderProjects();
    logStatus(`📁 Папка "${name}" создана.`, "success");
}

function openFolder(id) {
    state.currentFolderId = id;
    renderProjects();
}

function exitFolder() {
    state.currentFolderId = null;
    renderProjects();
}

// --- PROJECT MANAGEMENT ---
function createNewProject() {
    const name = prompt("Введите название видео-проекта:", "Новый проект");
    if (!name) return;

    const newProject = {
        id: Date.now(),
        name: name,
        folderId: state.currentFolderId, 
        prefix: DEFAULT_PREFIX, 
        scriptPrefix: "Напиши подробный сценарий для серии мультфильма про...",
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

function renderProjects() {
    const container = document.getElementById('project-list-container');
    const description = document.getElementById('projects-view-description');
    if (!container) return;

    container.innerHTML = "";

    // 1. Handle Navigation Header (Breadcrumbs)
    if (state.currentFolderId) {
        const folder = state.folders.find(f => f.id === state.currentFolderId);
        const folderName = folder ? folder.name : "Папка";
        
        if (description) description.innerHTML = `<span style="color:var(--accent-primary); cursor:pointer;" onclick="exitFolder()">Мои Проекты</span> / <b>${folderName}</b>`;
        
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
        if (description) description.innerText = "Управляйте своими анимационными проектами по папкам.";
    }

    // 2. Render Folders (only at root)
    if (!state.currentFolderId) {
        state.folders.forEach(f => {
            const projectCount = state.projects.filter(p => p.folderId === f.id).length;
            const card = document.createElement('div');
            card.className = "project-card folder-card";
            card.onclick = () => openFolder(f.id);
            card.innerHTML = `
                <div class="folder-badge">ПАПКА</div>
                <div class="folder-icon">📂</div>
                <div class="project-name">${f.name}</div>
                <div class="project-meta">${projectCount} проектов • ${f.created}</div>
                <button class="btn-folder-settings" onclick="openFolderSettings(${f.id}, event)" title="Настройки папки">⚙️</button>
                <button class="lib-del-btn" onclick="event.stopPropagation(); deleteFolder(${f.id})" style="top: 20px;">×</button>
            `;
            container.appendChild(card);
        });
    }

    // 3. Render Projects (filtered by current folder)
    const filteredProjects = state.projects.filter(p => p.folderId === state.currentFolderId);
    
    if (filteredProjects.length === 0 && !state.currentFolderId && state.folders.length === 0) {
        container.innerHTML = `
            <div class="project-card btn-add-project" onclick="createNewProject()" style="grid-column: 1/-1; height: 180px;">
                <div class="brand">
                    <span style="font-size: 24px;">📺</span>
                    <h1>ANIMTUBE<br><small style="font-size: 10px; color: var(--accent-primary); letter-spacing: 2px;">V12.0 ENGINE</small></h1>
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
            <button class="btn-move-project" title="Переместить" onclick="event.stopPropagation(); requestMoveProject(${p.id})">📦</button>
            <div class="folder-icon">🎬</div>
            <div class="project-name">${p.name}</div>
            <div class="project-meta">${p.results ? p.results.length : 0} кадров • ${p.created}</div>
        `;
        container.appendChild(card);
    });
}

function deleteFolder(id) {
    if (!confirm("Удалить папку? Проекты внутри НЕ будут удалены, они переместятся в корень.")) return;
    
    state.folders = state.folders.filter(f => f.id !== id);
    state.projects.forEach(p => {
        if (p.folderId === id) p.folderId = null;
    });
    
    saveState();
    renderProjects();
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
    document.getElementById('current-project-name').innerText = project.name;
    
    // Initialize project prefixes in UI
    const prefixInput = document.getElementById('project-specific-prefix');
    if (prefixInput) prefixInput.value = project.prefix || DEFAULT_PREFIX;

    const scriptPrefixInput = document.getElementById('project-script-prefix');
    if (scriptPrefixInput) scriptPrefixInput.value = project.scriptPrefix || "";

    // Migration: ensure project has script fields if it's old
    if (!project.scripts) project.scripts = [];
    if (!project.scriptPrefix) project.scriptPrefix = "Напиши сценарий для серии...";

    // Default to "Script" tab on open
    switchProjectTab('script');

    renderProjectScripts();
    renderProjectLibrary();
    renderProjectAssets();
    renderProjectPrompts();
    renderQueue();
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

async function downloadProjectFiles() {
    const project = getCurrentProject();
    if (!project || project.results.length === 0) return alert("Нет кадров для скачивания!");
    
    logStatus("💾 Подготовка файлов к скачиванию...", "info");
    
    for (let i = 0; i < project.results.length; i++) {
        const res = project.results[project.results.length - 1 - i]; 
        const base64 = await getImageFromDB(res.id);
        if (base64) {
            const link = document.createElement('a');
            link.href = base64;
            link.download = `frame_${project.id}_${i+1}.png`;
            link.click();
            await new Promise(r => setTimeout(r, 200));
        }
    }
    logStatus("✅ Все файлы скачаны!", "success");
}

function saveState() {
    localStorage.setItem('animtube_projects', JSON.stringify(state.projects));
    localStorage.setItem('animtube_folders', JSON.stringify(state.folders));
    localStorage.setItem('animtube_keys', JSON.stringify(state.keys));
}

// --- BATCH GENERATION ---
function startRollAssembly() {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }
    
    state.assembly.queue = [...project.promptsList];
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    state.assembly.lockedProjectId = state.activeProjectId; // Gallery Isolation Lock
    
    document.getElementById('btn-start-assembly').style.display = 'none';
    document.getElementById('btn-stop-assembly').style.display = 'flex';
    document.getElementById('receiving-slot-panel').style.display = 'block';
    
    logStatus("🎬 Сборка запущена. Переключаемся в Gemini...", "info");
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
        return;
    }

    const project = getCurrentProject();
    const rawPrompt = state.assembly.queue[state.assembly.currentIdx];
    
    // FETCH PREFIX FROM FOLDER (v12.0)
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    const fullPrompt = rawPrompt.includes(prefix) ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
    
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

    state.assembly.lastSentPrompt = rawPrompt;
    window.postMessage({ 
        type: "ANIMTUBE_CMD", 
        prompt: fullPrompt,
        assets: matchingAssets,
        assetIds: matchedIds // v11.16
    }, "*");
    
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
    saveState();
    
    renderProjectLibrary();
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
    entry.style.color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#5eb5f7');
    entry.style.marginBottom = '4px';
    entry.innerHTML = `<span style="opacity:0.4">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

function loadKeysData() {
    const keyGemini = document.getElementById('key-gemini');
    if (keyGemini) keyGemini.value = state.keys.gemini || "";
    
    const keyGrok = document.getElementById('key-grok');
    if (keyGrok) keyGrok.value = state.keys.grok || "";
}

function saveKeys() {
    state.keys.gemini = document.getElementById('key-gemini').value;
    state.keys.grok = document.getElementById('key-grok').value;
    saveState();
    logStatus("✅ API Ключи сохранены.", "success");
}

async function triggerDeployment() {
    logStatus("🚀 Запуск процесса деплоя...", "info");
    
    // In a browser environment, we can't run .bat files directly.
    // We show a professional instruction modal or just a clear guide.
    const repoUrl = "https://github.com/multoretik-bit/Anim_Tube";
    
    const confirmMsg = `
⚡ ГОТОВНОСТЬ К ДЕПЛОЮ ⚡
----------------------------------
Цель: ${repoUrl}

Для завершения публикации:
1. Запустите файл 'deploy.bat' в папке проекта.
2. Введите сообщение для коммита.
3. Дождитесь завершения (🎉 УСПЕШНО).

Открыть ваш репозиторий в браузере сейчас?
    `;
    
    if (confirm(confirmMsg)) {
        window.open(repoUrl, '_blank');
        logStatus("🌐 Репозиторий открыт. Ожидание запуска deploy.bat...", "success");
    } else {
        logStatus("ℹ️ Деплой отложен пользователем.", "info");
    }
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
        const card = document.querySelector(`[data-asset-id="${id}"]`);
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
                             state.assembly.queue.length === 1 && 
                             state.assembly.queue[0] === p;
                             
        return `
            <div class="prompt-item ${isProcessing ? 'processing' : ''}" id="prompt-item-${index}">
                <div class="prompt-header">
                    <div class="prompt-counter">${index + 1}</div>
                    <div style="font-size: 10px; color: var(--text-dim); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">
                        ${isProcessing ? '⚡ ОБРАБОТКА' : 'КАДР'}
                    </div>
                </div>
                <textarea class="prompt-textarea" 
                          onchange="updatePromptValue(${index}, this.value)" 
                          placeholder="Опишите, что происходит в этом кадре...">${p}</textarea>
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

function recreateSinglePrompt(index) {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList[index] === undefined) return;
    
    // Safety: don't start if already running something else
    if (state.assembly.isRunning) {
        if (!confirm("Сейчас идет сборка. Остановить и пересоздать этот кадр?")) return;
        stopRollAssembly(false);
    }
    
    const prompt = project.promptsList[index];
    if (!prompt || prompt.trim().length < 2) return alert("Промт слишком короткий!");

    // Setup mini-assembly
    state.assembly.queue = [prompt];
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    state.assembly.lockedProjectId = state.activeProjectId;
    
    // UI state
    document.getElementById('btn-start-assembly').style.display = 'none';
    document.getElementById('btn-stop-assembly').style.display = 'flex';
    document.getElementById('receiving-slot-panel').style.display = 'block';
    
    logStatus(`🔄 Пересоздание кадра #${index + 1}...`, "info");
    
    // Refresh UI to show "Processing" state
    renderProjectPrompts();
    
    // Start
    processNextItem();
}

function addPromptToProject() {
    const project = getCurrentProject();
    if (!project) return;
    if (!project.promptsList) project.promptsList = [];
    
    project.promptsList.push("");
    saveState();
    renderProjectPrompts();
}

function updatePromptValue(index, value) {
    const project = getCurrentProject();
    if (project && project.promptsList) {
        project.promptsList[index] = value;
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
