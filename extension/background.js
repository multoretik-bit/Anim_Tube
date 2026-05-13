// AnimTube Bridge v1.1 - BULK & DELETE Support
const processedMsgIds = new Set();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.msgId) {
        if (processedMsgIds.has(request.msgId)) return;
        processedMsgIds.add(request.msgId);
        setTimeout(() => processedMsgIds.delete(request.msgId), 60000);
    }
    if (request.type === "TO_GEMINI") {
        executeLiteralCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "ANIMTUBE_CMD_SCRIPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "ANIMTUBE_CMD_SPLIT") {
        executeSplitCycle(request.script, request.prefix);
    } else if (request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    } else if (request.type === "TO_GROK") {
        executeGrokCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "FROM_GEMINI") {
        relayToStudio(request);
        setTimeout(() => {
            focusStudio();
            setTimeout(() => relayToStudio({ type: "ANIMTUBE_CMD_PASTE_AUTO" }), 3000);
        }, 3000); 
    }
    return true;
});

async function executeSplitCycle(scriptText, customPrefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (text) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: text });

    report("🤖 РОБОТ: Запуск разделения сценария на промпты...");

    // 1. Find Gemini Tab
    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));

    if (!geminiTab) {
        report("❌ Gemini не открыт. Откройте его и попробуйте снова.");
        return;
    }

    chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(1500);

    // 2. Input the Split Instruction
    report("⌨️ Ввод сценария и инструкции по разделению...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: (text, prefix) => {
            const editor = document.querySelector(".ql-editor") || document.querySelector("input") || document.querySelector("textarea");
            if (editor) {
                // v1.2.3: Use custom prefix if provided
                const finalInstruction = (prefix && prefix.trim()) ? prefix : "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.";
                const prompt = finalInstruction + "\n\n" + text;
                
                if (editor.tagName === "DIV") editor.innerHTML = "<p>" + prompt.replace(/\n/g, '<br>') + "</p>";
                else editor.value = prompt;
                
                setTimeout(() => {
                    const sendBtn = document.querySelector('button[aria-label*="Send"], .send-button, [data-test-id="send-button"]');
                    if (sendBtn) sendBtn.click();
                }, 500);
            }
        },
        args: [scriptText, customPrefix]
    });

    // 3. Wait for Gemini (60 seconds as requested)
    const waitTime = 60;
    for (let i = waitTime; i >= 0; i--) {
        report(`⌛ Gemini создает 20 кадров... (${i}с)`);
        await sleep(1000);
    }

    // 4. Capture the Result (Try to click Copy Button + innerText fallback)
    report("📋 Копирование промптов из Gemini...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            // Scroll to bottom
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await sleep(1000);
            
            // Try to find and click the "Copy" button of the LAST message
            const copyButtons = document.querySelectorAll('button[aria-label*="Copy"], button[title*="Copy"], .copy-button');
            if (copyButtons.length > 0) {
                const lastCopyBtn = copyButtons[copyButtons.length - 1];
                lastCopyBtn.click();
                return "CLICKED";
            }
            return "NOT_FOUND";
        }
    });

    // Capture the text as well for the Studio relay (fallback/parsed)
    const captureResult = await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const responses = document.querySelectorAll('.model-response-text, .message-content, .prose, [data-message-author-role="assistant"]');
            if (responses.length > 0) {
                const lastRes = responses[responses.length - 1];
                return lastRes.innerText || lastRes.textContent;
            }
            return "";
        }
    });

    const parsedText = captureResult[0].result;

    if (parsedText) {
        report("✅ Данные захвачены! Возвращаюсь в Студию...");
        await sleep(1500);
        focusStudio();
        await sleep(1000);
        // Relay to Studio so the "Bulk Paste" can be auto-triggered or manually pasted
        relayToStudio({ type: "FROM_GEMINI_PROMPTS", text: parsedText });
    } else {
        report("❌ Не удалось захватить промпты.");
    }
}

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

    // --- STEP 0.5: STAY ON STUDIO FOR 3 SEC — копируем промт в буфер ---
    if (studioTab) {
        chrome.windows.update(studioTab.windowId, { focused: true });
        chrome.tabs.update(studioTab.id, { active: true });
        
        // Включаем реальное копирование текста на странице Студии
        report("📋 Студия: Готовлю текст к копированию...");
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] });
        
        report("⏳ Ожидание 3 сек — Studio копирует промт... (3)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Studio копирует промт... (2)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Studio копирует промт... (1)");
        await sleep(1000);
        report("✅ Промт в буфере! Перехожу в Gemini...");
        await sleep(300);
    }

    // --- STEP 1: FOCUS GEMINI & PASTE TEXT ---
    chrome.windows.update(geminiTab.windowId, { focused: true });
    chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(1500); 
    
    report("✏️ Вставляю текст промта в Gemini...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: (text) => {
            const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor') || document.querySelector('textarea');
            if (editor) {
                editor.focus();
                // Очистка
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                
                // Вставка через clipboard API если возможно, иначе через insertText
                // Но так как мы в executeScript, у нас есть доступ к 'text' (аргумент)
                
                // Для надежности вставки многострочного текста в Gemini:
                if (editor.tagName === "DIV") {
                    editor.innerText = text;
                } else {
                    editor.value = text;
                }
                
                // Триггерим события, чтобы Gemini "увидел" текст
                ['input', 'change', 'keydown', 'keyup', 'blur'].forEach(t => {
                    editor.dispatchEvent(new Event(t, { bubbles: true }));
                });
                
                // Маленький хак для Gemini: если innerText не сработал на 100%, пробуем еще и execCommand
                if (editor.innerText.length < 5) {
                    document.execCommand('insertText', false, text);
                }
            }
        },
        args: [promptText]
    });

    report("🤔 Промт введен. Жду 3 сек...");
    await sleep(3000);

    // --- STEP 2: RETURN TO STUDIO FOR VISUAL COPY (v11.17) ---
    if (studioTab) {
        chrome.windows.update(studioTab.windowId, { focused: true });
        chrome.tabs.update(studioTab.id, { active: true });
        
        report(`🔄 Возвращаюсь в Студию для копирования промта...`);
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] }); 
        
        // ⏳ 3 секунды: Studio должна успеть скопировать промт в буфер
        report("⏳ Ожидание 3 сек — Studio копирует промт... (3)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Studio копирует промт... (2)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Studio копирует промт... (1)");
        await sleep(1000);
        report("✅ Промт скопирован. Перехожу в Gemini для вставки...");
        await sleep(500);
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
            
            // Wait for generation (User quested increase from 70/80s to 120s)
            await sleep(120000);

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

// --- GROK ANIMATION CYCLE (v1.3.1) ---
async function executeGrokCycle(promptText, assets, assetIds) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });

    report("🚀 Extension: Получена команда TO_GROK. Ищу вкладки...");

    const tabs = await chrome.tabs.query({});
    report(`🔍 Всего найдено вкладок: ${tabs.length}`);
    
    const grokTab = tabs.find(t => {
        const hasGrokUrl = t.url && (t.url.includes("grok.com") || t.url.includes("x.com/i/grok"));
        const hasGrokTitle = t.title && t.title.toLowerCase().includes("grok");
        return hasGrokUrl || hasGrokTitle;
    });
    
    const studioTab = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));

    if (!grokTab) {
        report(`❌ Ошибка: Вкладка Grok (grok.com) не найдена среди ${tabs.length} вкладок!`);
        return;
    }

    report(`✅ Найдена вкладка Grok! ID: ${grokTab.id}`);

    if (studioTab) {
        try {
            await chrome.windows.update(studioTab.windowId, { focused: true });
            await chrome.tabs.update(studioTab.id, { active: true });
        } catch (e) {
            report("⚠️ Студия не может быть сфокусирована, но продолжаю...");
        }
        
        report("📋 Студия: Готовлюсь к копированию кадра...");
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] });
        
        report("⏳ Ожидание 3 сек — Имитация копирования... (3)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Имитация копирования... (2)");
        await sleep(1000);
        report("⏳ Ожидание 3 сек — Имитация копирования... (1)");
        await sleep(1000);
        report("✅ Кадр готов. Перехожу в Grok...");
        await sleep(300);
    }

    try {
        await chrome.windows.update(grokTab.windowId, { focused: true });
        await chrome.tabs.update(grokTab.id, { active: true });
    } catch (e) {
        report("❌ Ошибка переключения на Grok: " + e.message);
        return;
    }
    await sleep(2000); 
    
    report("✏️ Вставляю промт и кадр в Grok...");
    
    await chrome.scripting.executeScript({
        target: { tabId: grokTab.id },
        func: async (text, imageAssets) => {
            const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            // Grok specific query selectors
            const editor = document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]');
            
            if (editor) {
                editor.focus();
                
                // Set text
                if (editor.tagName === "TEXTAREA") {
                    editor.value = text;
                } else {
                    editor.innerText = text;
                }
                
                ['input', 'change', 'keydown'].forEach(t => editor.dispatchEvent(new Event(t, { bubbles: true })));
                
                await sleep(1000);
                
                // Paste Image
                if (imageAssets && imageAssets.length > 0) {
                    try {
                        const base64 = imageAssets[0];
                        const parts = base64.split(';base64,');
                        if (parts.length >= 2) {
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
                            const file = new File([blob], "frame.png", { type: contentType });
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            
                            editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
                            report("✅ Кадр вставлен в Grok!");
                            await sleep(2500); // give it time to upload/process
                        }
                    } catch (e) { report("⚠️ Ошибка вставки кадра: " + e.message); }
                }
                
                // Submit
                const sendBtn = document.querySelector('button[aria-label="Grok something"], button[aria-label*="Send"], svg.fa-arrow-up')?.closest('button');
                if (sendBtn) {
                    sendBtn.click();
                } else {
                    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                }
            }
        },
        args: [promptText, assets]
    });

    report("⏳ Ожидание генерации анимации (минимум 80 сек)...");
    
    // Wait for generation (Animation takes longer)
    const waitTime = 120;
    for (let i = waitTime; i >= 0; i-=10) {
        if (i > 0) {
            report(`⌛ Grok создает анимацию... (${i}с)`);
            await sleep(10000);
        }
    }

    report("📥 Поиск готовой анимации...");
    await chrome.scripting.executeScript({
        target: { tabId: grokTab.id },
        func: async () => {
            const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            // Try to find video first, then image
            const allVideos = Array.from(document.querySelectorAll('video'));
            const allImgs = Array.from(document.querySelectorAll('img')).filter(img => (img.naturalWidth || img.clientWidth) > 200);
            
            let mediaSrc = null;
            let isVideo = false;
            
            if (allVideos.length > 0) {
                mediaSrc = allVideos[allVideos.length - 1].src;
                isVideo = true;
            } else if (allImgs.length > 0) {
                // Ignore avatars
                const contentImgs = allImgs.filter(img => !img.src.includes('avatar') && !img.src.includes('profile'));
                if (contentImgs.length > 0) {
                    mediaSrc = contentImgs[contentImgs.length - 1].src;
                }
            }

            if (mediaSrc) {
                report("✅ Анимация найдена! Скачиваю и отправляю в Студию...");
                try {
                    const res = await fetch(mediaSrc);
                    const blob = await res.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        chrome.runtime.sendMessage({ type: "FROM_GROK", base64: reader.result });
                    };
                    reader.readAsDataURL(blob);
                } catch (err) {
                    report("❌ Ошибка извлечения видео: " + err.message);
                }
            } else {
                report("❌ Не удалось найти готовую анимацию на странице.");
            }
        }
    });
    
    await sleep(5000);
    report("🔄 Возврат на страницу генерации (grok.com/imagine)...");
    try {
        await chrome.tabs.update(grokTab.id, { url: "https://grok.com/imagine" });
    } catch (e) {}
    await sleep(1000);
    focusStudio();
}

function relayToStudio(msg) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const isStudio = tab.url && (tab.url.includes("localhost") || tab.url.includes("127.0.0.1") || (tab.title && tab.title.includes("AnimTube")));
            if (isStudio) {
                try {
                    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
                } catch (e) {}
            }
        });
    });
}

function focusStudio() {
    chrome.tabs.query({}, (tabs) => {
        const t = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || (t.title && t.title.includes("AnimTube"))));
        if (t && t.id) { 
            try { chrome.windows.update(t.windowId, { focused: true }).catch(() => {}); } catch(e){}
            try { chrome.tabs.update(t.id, { active: true }).catch(() => {}); } catch(e){}
        }
    });
}
