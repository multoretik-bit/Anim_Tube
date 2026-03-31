// AnimTube Bridge v1.0.1 - FULL AUTOMATION Loop
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TO_GEMINI") {
        executeLiteralCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "ANIMTUBE_CMD_SCRIPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    } else if (request.type === "FROM_GEMINI") {
        relayToStudio(request);
        setTimeout(() => {
            focusStudio();
            setTimeout(() => relayToStudio({ type: "ANIMTUBE_CMD_PASTE_AUTO" }), 3000);
        }, 3000); 
    }
    return true;
});

async function executeScriptCycle(prefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });

    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
    
    if (!geminiTab) {
        report("❌ Ошибка: Вкладка Gemini не найдена!");
        return;
    }

    report("🛰️ ПЕРЕКЛЮЧЕНИЕ НА GEMINI...");
    
    // 1. Focus & Paste
    await chrome.windows.update(geminiTab.windowId, { focused: true });
    await chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(1500); 

    report("✏️ Ввожу запрос для сценария...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async (text) => {
            const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
            if (editor) {
                editor.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, text);
                
                await new Promise(r => setTimeout(r, 800));
                
                const sendBtn = document.querySelector('button[aria-label*="Send"]') || 
                                document.querySelector('button[aria-label*="Отправить"]') ||
                                document.querySelector('.send-button');
                if (sendBtn) sendBtn.click();
            }
        },
        args: [prefix]
    });

    // 2. WAIT WITH COUNTDOWN (90 seconds)
    for (let i = 90; i > 0; i--) {
        report(`⏳ Ожидание сценария: ${i} сек...`);
        await sleep(1000);
        if (i % 30 === 0) {
            // Re-focus Gemini occasionally just in case
            chrome.tabs.update(geminiTab.id, { active: true });
        }
    }

    // 3. Native Copy Button Click (v1.0.1 - Full Automation)
    report("📋 Скроллинг и глубокий поиск кнопки копирования...");
    const scriptCapture = await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            // 1. Force multiple scrolls to the bottom
            for (let i = 0; i < 3; i++) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await sleep(500);
            }
            
            // 2. Scan ALL buttons for a "Copy" label
            const allBtns = Array.from(document.querySelectorAll('button'));
            const copyBtns = allBtns.filter(b => {
                const label = (b.getAttribute('aria-label') || "").toLowerCase();
                const title = (b.getAttribute('title') || "").toLowerCase();
                return label.includes("copy") || label.includes("копировать") || 
                       title.includes("copy") || title.includes("копировать");
            });

            // 3. Get the text itself just in case (fallback and relay)
            const responses = document.querySelectorAll('.model-response-text, .message-content, .prose, [data-message-author-role="assistant"]');
            let capturedText = "";
            if (responses.length > 0) {
                const lastRes = responses[responses.length - 1];
                capturedText = lastRes.innerText || lastRes.textContent;
            }

            if (copyBtns.length > 0) {
                const targetedBtn = copyBtns[copyBtns.length - 1];
                targetedBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(1000);
                targetedBtn.click();
                chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: "✅ Кнопка Gemini нажата. Сценарий в буфере." });
                await sleep(1000);
            } else if (capturedText) {
                await navigator.clipboard.writeText(capturedText.trim());
                chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: "⌨️ Текст скопирован напрямую." });
            }

            return capturedText.trim();
        }
    });

    const fullScriptText = scriptCapture[0].result;

    await sleep(1500);
    focusStudio();
    await sleep(800);

    // 4. AUTO-CLICK PASTE IN STUDIO (v1.0.1)
    if (fullScriptText) {
        const studioTabs = await chrome.tabs.query({});
        const targetStudio = studioTabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));
        
        if (targetStudio) {
            report("🤖 РОБОТ: Автоматическая вставка сценария...");
            await chrome.scripting.executeScript({
                target: { tabId: targetStudio.id },
                func: (text) => {
                    // Try to find the pending script card and its paste button
                    const pendingCard = document.querySelector('.script-card.pending');
                    if (pendingCard) {
                        const pasteBtn = pendingCard.querySelector('.script-btn-paste');
                        if (pasteBtn) {
                            // Focus it for visual effect
                            pasteBtn.classList.add('flash-active');
                            setTimeout(() => pasteBtn.classList.remove('flash-active'), 1000);
                        }
                    }
                    // Relay the script through the web page message bus
                    window.postMessage({ type: "FROM_GEMINI_SCRIPT", text: text }, "*");
                },
                args: [fullScriptText]
            });
            report("✅ ЦИКЛ ЗАВЕРШЕН. Сценарий вставлен!");
        } else {
            report("⚠️ Вкладка Студии потеряна. Нажмите 'Вставить' вручную.");
        }
    } else {
        report("❌ Ошибка: Сценарий не захвачен.");
    }
}

async function executeLiteralCycle(promptText, assets, assetIds) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });

    // 0. FIND TABS
    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
    const studioTab = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));

    if (!geminiTab) {
        report("❌ Ошибка: Вкладка Gemini не найдена!");
        return;
    }

    // --- STEP 1: FOCUS GEMINI & PASTE TEXT FIRST (v11.17) ---
    chrome.windows.update(geminiTab.windowId, { focused: true });
    chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(800); 
    
    report("✏️ Вставляю текст промта...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: (text) => {
            const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
            if (editor) {
                editor.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, text);
                ['input', 'change', 'blur'].forEach(t => editor.dispatchEvent(new Event(t, { bubbles: true })));
            }
        },
        args: [promptText]
    });

    report("🤔 Промт введен (v11.17). Жду 3 сек...");
    await sleep(3000);

    // --- STEP 2: RETURN TO STUDIO FOR VISUAL COPY (v11.17) ---
    if (studioTab) {
        chrome.windows.update(studioTab.windowId, { focused: true });
        chrome.tabs.update(studioTab.id, { active: true });
        
        report(`🔄 Возвращаюсь в Студию для копирования ассетов...`);
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] }); 
        
        await sleep(4000); // Visual Copy duration
    }

    // --- STEP 3: RETURN TO GEMINI FOR ASSETS ---
    chrome.windows.update(geminiTab.windowId, { focused: true });
    chrome.tabs.update(geminiTab.id, { active: true });
    report("🤔 Возврат в Gemini. Вставка ассетов (3 сек)...");
    await sleep(3000);

    // --- STEP 4: PASTE ASSETS ---
    if (assets && assets.length > 0) {
        report(`📦 Инъекция ${assets.length} ассетов...`);
        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: async (imageAssets) => {
                const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                if (editor) {
                    for (const base64 of imageAssets) {
                        try {
                            const parts = base64.split(';base64,');
                            if (parts.length < 2) continue;
                            const contentType = parts[0].split(':')[1];
                            const byteCharacters = atob(parts[1]);
                            const byteArrays = [];
                            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                                const slice = byteCharacters.slice(offset, offset + 512);
                                const byteNumbers = new Array(slice.length);
                                for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
                                byteArrays.push(new Uint8Array(byteNumbers));
                            }
                            const blob = new Blob(byteArrays, { type: contentType });
                            const file = new File([blob], "asset.png", { type: contentType });
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            
                            editor.click();
                            editor.focus();
                            await sleep(500);

                            editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
                            report("✅ Ассет вставлен!");
                            await sleep(2000);
                        } catch (e) { report("⚠️ Ошибка: " + e.message); }
                    }
                }
            },
            args: [assets]
        });
        report("✅ Ассеты добавлены!");
    } else {
        report("ℹ️ Дополнительные ассеты не найдены.");
    }

    // --- STEP 5: FINALIZE & SEND (1s) ---
    report("⏳ Финализация (1 сек)...");
    await sleep(1000);

    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            const sendBtn = document.querySelector('button[aria-label*="Send"]') || document.querySelector('button[aria-label*="Отправить"]');
            if (sendBtn) {
                sendBtn.click();
            } else {
                const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                if (editor) {
                    editor.focus();
                    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                }
            }
            report("🚀 ЦИКЛ ЗАВЕРШЕН (v11.17)!");
            
            // Wait for generation
            await sleep(81000);

            // CAPTURE
            const allImgs = Array.from(document.querySelectorAll('img'));
            const frames = allImgs.filter(img => (img.naturalWidth || img.clientWidth) > 200);
            if (frames.length > 0) {
                const img = frames[frames.length - 1];
                img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await sleep(1400);
                let p = img;
                for (let i = 0; i < 7; i++) { if (p.parentElement) p = p.parentElement; }
                const copyBtn = p.querySelector('button[aria-label*="Copy"], button[aria-label*="Копировать"]');
                if (copyBtn) copyBtn.click();
                
                const res = await fetch(img.src);
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => chrome.runtime.sendMessage({ type: "FROM_GEMINI", base64: reader.result });
                reader.readAsDataURL(blob);
            }
        }
    });
}

function relayToStudio(msg) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const isStudio = tab.url && (tab.url.includes("localhost") || tab.url.includes("127.0.0.1") || (tab.title && tab.title.includes("AnimTube")));
            if (isStudio) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
        });
    });
}

function focusStudio() {
    chrome.tabs.query({}, (tabs) => {
        const t = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || (t.title && t.title.includes("AnimTube"))));
        if (t) { 
            chrome.windows.update(t.windowId, { focused: true }); 
            chrome.tabs.update(t.id, { active: true }); 
        }
    });
}
