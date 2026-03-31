// AnimTube Bridge v1.1 - BULK & DELETE Support
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TO_CHATGPT") {
        executeLiteralCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "ANIMTUBE_CMD_SCRIPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "ANIMTUBE_CMD_SPLIT") {
        executeSplitCycle(request.script, request.prefix);
    } else if (request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    } else if (request.type === "FROM_CHATGPT") {
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

    // 1. Find ChatGPT Tab
    const tabs = await chrome.tabs.query({});
    const aiTab = tabs.find(t => t.url && (t.url.includes("chatgpt.com") || t.url.includes("chat.openai.com")));

    if (!aiTab) {
        report("❌ ChatGPT не открыт. Откройте его и попробуйте снова.");
        return;
    }

    chrome.tabs.update(aiTab.id, { active: true });
    await sleep(1500);

    // 2. Input the Split Instruction
    report("⌨️ Ввод сценария и инструкции по разделению...");
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: (text, prefix) => {
            const editor = document.querySelector("#prompt-textarea");
            if (editor) {
                const finalInstruction = (prefix && prefix.trim()) ? prefix : "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.";
                const prompt = finalInstruction + "\n\n" + text;
                
                editor.focus();
                editor.value = prompt;
                
                // Trigger input event for ChatGPT
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                    const sendBtn = document.querySelector('[data-testid="send-button"]');
                    if (sendBtn) sendBtn.click();
                }, 500);
            }
        },
        args: [scriptText, customPrefix]
    });

    // 3. Wait for ChatGPT (60 seconds)
    const waitTime = 60;
    for (let i = waitTime; i >= 0; i--) {
        report(`⌛ ChatGPT создает кадры... (${i}с)`);
        await sleep(1000);
    }

    // 4. Capture the Result
    report("📋 Копирование промптов из ChatGPT...");
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
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

    // Capture the text
    const captureResult = await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async () => {
            const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
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
        // Relay to Studio
        relayToStudio({ type: "FROM_CHATGPT_PROMPTS", text: parsedText });
    } else {
        report("❌ Не удалось захватить промпты.");
    }
}

async function executeScriptCycle(prefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });

    const tabs = await chrome.tabs.query({});
    const aiTab = tabs.find(t => t.url && (t.url.includes("chatgpt.com") || t.url.includes("chat.openai.com")));
    
    if (!aiTab) {
        report("❌ Ошибка: Вкладка ChatGPT не найдена!");
        return;
    }

    report("🛰️ ПЕРЕКЛЮЧЕНИЕ НА CHATGPT...");
    
    // 1. Focus & Paste
    await chrome.windows.update(aiTab.windowId, { focused: true });
    await chrome.tabs.update(aiTab.id, { active: true });
    await sleep(1500); 

    report("✏️ Ввожу запрос для сценария...");
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async (text) => {
            const editor = document.querySelector('#prompt-textarea');
            if (editor) {
                editor.focus();
                editor.value = text;
                
                // Trigger input event
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                
                await new Promise(r => setTimeout(r, 800));
                
                const sendBtn = document.querySelector('[data-testid="send-button"]');
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
            // Re-focus ChatGPT
            chrome.tabs.update(aiTab.id, { active: true });
        }
    }

    // 3. Native Copy Button Click
    report("📋 Скроллинг и глубокий поиск кнопки копирования...");
    const scriptCapture = await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            // 1. Force multiple scrolls to the bottom
            for (let i = 0; i < 3; i++) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await sleep(500);
            }
            
            // 2. Scan for Copy button
            const copyBtns = document.querySelectorAll('button[aria-label="Copy"]');

            // 3. Get the text itself
            const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
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
                chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: "✅ Кнопка ChatGPT нажата. Сценарий в буфере." });
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
                    window.postMessage({ type: "FROM_CHATGPT_SCRIPT", text: text }, "*");
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
    const aiTab = tabs.find(t => t.url && (t.url.includes("chatgpt.com") || t.url.includes("chat.openai.com")));
    const studioTab = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));

    if (!aiTab) {
        report("❌ Ошибка: Вкладка ChatGPT не найдена!");
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
        report("✅ Промт в буфере! Перехожу в ChatGPT...");
        await sleep(300);
    }

    // --- STEP 1: FOCUS CHATGPT & PASTE TEXT ---
    chrome.windows.update(aiTab.windowId, { focused: true });
    chrome.tabs.update(aiTab.id, { active: true });
    await sleep(1500); 
    
    report("✏️ Вставляю текст промта в ChatGPT...");
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: (text) => {
            const editor = document.querySelector("#prompt-textarea");
            if (editor) {
                editor.focus();
                editor.value = text;
                
                // Trigger input event
                editor.dispatchEvent(new Event('input', { bubbles: true }));
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

    // --- STEP 3: RETURN TO CHATGPT FOR ASSETS ---
    chrome.windows.update(aiTab.windowId, { focused: true });
    chrome.tabs.update(aiTab.id, { active: true });
    report("🤔 Возврат в ChatGPT. Вставка ассетов (3 сек)...");
    await sleep(3000);

    // --- STEP 4: PASTE ASSETS ---
    if (assets && assets.length > 0) {
        report(`📦 Инъекция ${assets.length} ассетов...`);
        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: async (imageAssets) => {
                const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const editor = document.querySelector("#prompt-textarea");
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
        target: { tabId: aiTab.id },
        func: async () => {
            const report = (msg) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: msg });
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            
            const sendBtn = document.querySelector('[data-testid="send-button"]');
            if (sendBtn) {
                sendBtn.click();
            }
            report("🚀 ЦИКЛ ЗАВЕРШЕН!");
            
            // Wait for generation
            await sleep(81000);

            // CAPTURE
            const allImgs = Array.from(document.querySelectorAll('img'));
            const frames = allImgs.filter(img => (img.naturalWidth || img.clientWidth) > 200);
            if (frames.length > 0) {
                const img = frames[frames.length - 1];
                img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await sleep(1400);
                
                const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
                const lastRes = responses[responses.length - 1];
                const copyBtn = lastRes ? lastRes.querySelector('button[aria-label="Copy"]') : null;
                if (copyBtn) copyBtn.click();
                
                const res = await fetch(img.src);
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => chrome.runtime.sendMessage({ type: "FROM_CHATGPT", base64: reader.result });
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
