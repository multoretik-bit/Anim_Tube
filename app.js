/**
 * AnimTube v1.1 - BULK & DELETE Support
 * Sequence: Text First -> Website Return -> Visual Copy -> ChatGPT Send
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
    const isAuto = state.assembly.superAuto && state.assembly.superAuto.active;
    if (isAuto) {
        if (msg.type === "ANIMTUBE_CMD") msg.type = "ANIMTUBE_AUTO_CMD";
        else if (msg.type === "ANIMTUBE_CMD_SCRIPT") msg.type = "ANIMTUBE_AUTO_CMD_SCRIPT";
        else if (msg.type === "ANIMTUBE_CMD_SPLIT") msg.type = "ANIMTUBE_AUTO_CMD_SPLIT";
    }
    window.postMessage(msg, "*");
}

// --- INITIALIZE ---
window.onload = async () => {
    await initDB();
    loadKeysData();
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

        // 8. GROK ANIMATION ARRIVAL
        if (event.data.type === "FROM_GROK") {
            handleIncomingAnimation(event.data.base64);
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
        if (clean) project.promptsList.push(clean);
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

    if (lines.length === 0) {
        logStatus("⚠️ Не удалось распознать промпты в ответе Gemini.", "error");
        return;
    }

    if (!project.promptsList) project.promptsList = [];
    project.promptsList = [...project.promptsList, ...lines];
    
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
    document.getElementById('modal-split-prefix').value = folder.splitPrefix || "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.";
    
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
    folder.splitPrefix = document.getElementById('modal-split-prefix').value;
    
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
        splitPrefix: "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.",
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
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;
    if (!confirm(`Удалить папку "${folder.name}"? Проекты внутри НЕ будут удалены, они переместятся в корень.`)) return;
    
    state.projects.forEach(p => {
        if (p.folderId === id) p.folderId = null;
    });
    
    state.folders = state.folders.filter(f => f.id !== id);
    saveState();
    renderProjects();
    logStatus(`🗑️ Папка "${folder.name}" удалена.`, "info");
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
    localStorage.setItem('animtube_keys', JSON.stringify(state.keys));
}

// --- BATCH GENERATION ---
async function startRollAssembly() {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }
    
    // EXPLICIT COPY OF FIRST PROMPT (v1.3.2)
    const firstRaw = project.promptsList[0];
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    const firstFull = firstRaw.includes(prefix) ? firstRaw : (prefix.trim() + "\n\n" + firstRaw.trim()).trim();
    
    await copyTextToClipboard(firstFull);
    logStatus("📋 [Промт 1]: Текст скопирован (Robotic Mode).", "success");

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
        
        if (state.assembly.superAuto.active && state.assembly.superAuto.phase === 'assembly') {
            stopSuperAutomation();
        } else {
            stopRollAssembly(false);
        }
        return;
    }

    const project = getCurrentProject();
    const rawPrompt = state.assembly.queue[state.assembly.currentIdx];
    
    // FETCH PREFIX FROM FOLDER (v12.0)
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

// --- ANIMATION RENDERER (v1.3.1) ---
async function renderProjectAnimation() {
    const project = getCurrentProject();
    const container = document.getElementById('animation-list-container');
    if (!project || !container) return;

    if (!project.promptsList || project.promptsList.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="text-align: center; color: var(--text-dim); padding: 60px;">
            <span style="font-size: 40px; display: block; margin-bottom: 20px;">🎬</span>
            Очередь анимации пуста. Сначала добавьте промты во вкладке «Кадры».
        </div>`;
        return;
    }

    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;

    let html = "";
    
    for (let i = 0; i < project.promptsList.length; i++) {
        const rawPrompt = project.promptsList[i];
        if (!rawPrompt || rawPrompt.trim().length < 2) continue;

        const fullPrompt = rawPrompt.includes(prefix) ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
        
        // Find the LATEST result matching this prompt
        // Search in reverse to get the newest frame
        const resultsArray = project.results || [];
        const matchingResult = [...resultsArray].find(r => r.promptSnippet === fullPrompt);
        let imgTag = "";
        let animTag = `
            <div class="anim-empty-frame">
                <span>📹</span> ЖДЕТ АНИМАЦИЮ
            </div>
        `;
        
        if (matchingResult) {
            const base64 = await getImageFromDB(matchingResult.id);
            imgTag = `<img src="${base64}">`;
            
            if (matchingResult.animationId) {
                const animBase64 = await getAnimationFromDB(matchingResult.animationId);
                animTag = `<video src="${animBase64}" autoplay loop muted></video>`;
            }
        } else {
            imgTag = `
                <div class="anim-empty-frame">
                    <span>🖼️</span> ОЖИДАНИЕ КАДРА
                </div>
            `;
        }

        const isProcessing = state.animAssembly.isRunning && state.animAssembly.currentIdx === i;

        html += `
            <div class="animation-row" id="anim-row-${i}" style="${isProcessing ? 'border-color: var(--accent-grok); background: rgba(236, 72, 153, 0.05);' : ''}">
                <div class="anim-index">${i + 1}</div>
                <div class="anim-prompt-text">${rawPrompt}</div>
                <div class="anim-frame-container" id="anim-frame-${i}">
                    ${imgTag}
                </div>
                <div class="anim-video-container">
                    ${animTag}
                    ${matchingResult && !matchingResult.animationId && !isProcessing ? `
                    <div class="anim-actions">
                        <button class="btn btn-primary" onclick="animateSingleFrame(${i})" style="padding: 8px 16px; font-size: 11px; background: var(--accent-grok);">🪄 Анимировать</button>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || `<p style="text-align: center; color: var(--text-dim);">Нет активных промтов.</p>`;
}

// --- GROK ANIMATION ORCHESTRATION ---
async function startAnimationAssembly() {
    const project = getCurrentProject();
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }
    
    // Build Queue: only include prompts that HAVE an associated generated frame but NO animation yet
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    state.animAssembly.queue = [];
    
    for (let i = 0; i < project.promptsList.length; i++) {
        const rawPrompt = project.promptsList[i];
        const fullPrompt = rawPrompt.includes(prefix) ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
        const resultsArray = project.results || [];
        const matchingResult = [...resultsArray].find(r => r.promptSnippet === fullPrompt);
        
        if (matchingResult && !matchingResult.animationId) {
            state.animAssembly.queue.push({
                index: i,
                prompt: fullPrompt,
                resultId: matchingResult.id
            });
        }
    }
    
    if (state.animAssembly.queue.length === 0) {
        return alert("Нет кадров, требующих анимации. Сгенерируйте новые кадры или пересоздайте существующие!");
    }
    
    state.animAssembly.currentIdx = 0;
    state.animAssembly.isRunning = true;
    state.animAssembly.lockedProjectId = state.activeProjectId;
    
    document.getElementById('btn-start-anim').style.display = 'none';
    document.getElementById('btn-stop-anim').style.display = 'block';
    
    logStatus(`🚀 Сборка анимации запущена (В очереди: ${state.animAssembly.queue.length}). Перекл. в Grok...`, "success");
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
    const folder = getFolderForProject(project.id);
    const prefix = (folder && folder.prefix) ? folder.prefix : DEFAULT_PREFIX;
    
    const rawPrompt = project.promptsList[index];
    const fullPrompt = rawPrompt.includes(prefix) ? rawPrompt : (prefix.trim() + "\n\n" + rawPrompt.trim()).trim();
    const resultsArray = project.results || [];
    const matchingResult = [...resultsArray].find(r => r.promptSnippet === fullPrompt);
    
    if (!matchingResult) return alert("Сначала сгенерируйте статичный кадр!");
    
    state.animAssembly.queue = [{
        index: index,
        prompt: fullPrompt,
        resultId: matchingResult.id
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
    logStatus(`🚀 [Анимация ${state.animAssembly.currentIdx + 1}/${state.animAssembly.queue.length}] Отправка в Grok...`, "info");
    
    // Explicit clipboard copy for prompt
    await copyTextToClipboard(item.prompt);
    
    const base64 = await getImageFromDB(item.resultId);
    
    sendToBridge({
        type: "TO_GROK", // Custom command for extension
        prompt: item.prompt,
        assets: [base64], // Send the actual base64 to be pasted
        assetIds: [`anim-frame-${item.index}`] // ID for visual copy trigger
    });
}

function triggerAnimVisualCopy(cardId) {
    // This expects the extension to call ANIMTUBE_CMD_VISUAL_COPY but with targeted ID
    runVisualCopyAnimation([cardId]); 
}

async function handleIncomingAnimation(base64) {
    const targetId = state.animAssembly.isRunning ? state.animAssembly.lockedProjectId : state.activeProjectId;
    const project = state.projects.find(p => p.id === targetId);
    if (!project) return;
    
    const currentItem = state.animAssembly.queue[state.animAssembly.currentIdx];
    if (!currentItem) return;
    
    // Save blob/base64
    const animId = "anim_" + Date.now();
    await saveAnimationToDB(animId, base64);
    
    // Link to the result frame
    const resultFrame = project.results.find(r => r.id === currentItem.resultId);
    if (resultFrame) {
        resultFrame.animationId = animId;
    }
    
    saveState();
    
    logStatus(`🎉 Анимация #${currentItem.index + 1} успешно добавлена!`, "success");
    
    state.animAssembly.currentIdx++;
    renderProjectAnimation();
    
    if (state.animAssembly.isRunning) {
        logStatus("⏳ Пауза 5 сек перед следующей анимацией...", "info");
        setTimeout(processNextAnimation, 5000);
    }
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
