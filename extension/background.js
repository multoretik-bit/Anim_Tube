// AnimTube Bridge v11.17 - ULTIMATE RESURRECTION EDITION
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
                
                await new Promise(r => setTimeout(r, 500));
                
                const sendBtn = document.querySelector('button[aria-label*="Send"]') || document.querySelector('button[aria-label*="Отправить"]');
                if (sendBtn) sendBtn.click();
            }
        },
        args: [prefix]
    });

    report("⏳ Ожидание генерации сценария (1.5 мин)...");
    await sleep(90000);

    // 2. Capture Text
    report("📋 Копирование сценария...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const selectors = [
                '.model-response-text',
                '.message-content',
                'div[role="log"] .message-content',
                'chat-window .model-response-text'
            ];
            
            let lastResponseText = "";
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    const last = elements[elements.length - 1];
                    lastResponseText = last.innerText || last.textContent;
                    if (lastResponseText.length > 100) break;
                }
            }

            if (lastResponseText.length > 10) {
                chrome.runtime.sendMessage({ type: "FROM_GEMINI_SCRIPT", text: lastResponseText });
            } else {
                // Final fallback: heavy scan
                const allDivs = document.querySelectorAll('div');
                for (let i = allDivs.length - 1; i >= 0; i--) {
                    if (allDivs[i].innerText && allDivs[i].innerText.length > 300) {
                        chrome.runtime.sendMessage({ type: "FROM_GEMINI_SCRIPT", text: allDivs[i].innerText });
                        return;
                    }
                }
                chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: "❌ Не удалось найти текст сценария." });
            }
        }
    });

    await sleep(2000);
    focusStudio();
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
