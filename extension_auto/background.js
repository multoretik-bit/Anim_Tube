let isLiteralCycleRunning = false;
let isRunningGrokCycle = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📥 [BACKGROUND] Received message:", request.type);
    if (request.type === "TO_CHATGPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "TO_GEMINI") {
        console.log("🎯 [BACKGROUND] Starting executeLiteralCycle (Telegram Version Logic)...");
        executeLiteralCycle(request.prompt, request.assets, request.assetIds, request.prevFrame);
    } else if (request.type === "FEEDBACK_TO_GEMINI") {
        executeFeedbackCycle(request.image);
    } else if (request.type === "TO_GROK") {
        console.log("🎬 [BACKGROUND] Starting executeGrokCycle...");
        executeGrokCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    } else if (request.type === "FROM_GEMINI") {
        relayToStudio(request);
        setTimeout(() => {
            focusStudio();
            setTimeout(() => {
                relayToStudio({ type: "ANIMTUBE_CMD_PASTE_AUTO" });
                console.log("✅ [BACKGROUND] Paste triggered.");
            }, 3000); 
        }, 3000); 
    } else if (request.type === "FROM_CHATGPT") {
        relayToStudio(request);
    } else if (request.type === "ANIMTUBE_CMD_SCRIPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "ANIMTUBE_CMD_SPLIT") {
        executeSplitCycle(request.script, request.prefix);
    } else if (request.type === "FROM_GROK_AUTO_DONE") {
        relayToStudio(request);
    }
    return true;
});

async function executeScriptCycle(prefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });
    const tabs = await chrome.tabs.query({});
    const aiTab = tabs.find(t => t.url && (t.url.includes("chatgpt.com") || t.url.includes("chat.openai.com")));
    
    if (!aiTab) {
        report("❌ ChatGPT не найден. Откройте chatgpt.com");
        return;
    }

    report("🤖 [АВТО]: Переход в ChatGPT для создания сценария...");
    await chrome.windows.update(aiTab.windowId, { focused: true });
    await chrome.tabs.update(aiTab.id, { active: true });
    await sleep(1500); 

    // 1. Insert and Send
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async (text) => {
            const editor = document.querySelector('#prompt-textarea');
            if (editor) {
                editor.focus();
                document.execCommand('insertText', false, text);
                setTimeout(() => {
                    const btn = document.querySelector('[data-testid="send-button"]');
                    if (btn) btn.click();
                }, 500);
            }
        },
        args: [prefix]
    });

    // 2. Wait for completion (Watch for the 'Stop' button to disappear or 'Copy' to appear)
    report("⌛ [АВТО]: Ожидание завершения написания сценария...");
    
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async () => {
            const poll = () => new Promise(resolve => {
                const interval = setInterval(() => {
                    // ChatGPT completion indicator: Send button is visible again and Stop button is gone
                    const sendBtn = document.querySelector('[data-testid="send-button"]');
                    const stopBtn = document.querySelector('[data-testid="stop-button"]');
                    if (sendBtn && !stopBtn) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 2000);
            });
            await poll();

            // 3. Scrape the last response
            const articles = document.querySelectorAll('article');
            if (articles.length > 0) {
                const lastResponse = articles[articles.length - 1];
                const text = lastResponse.innerText || lastResponse.textContent;
                chrome.runtime.sendMessage({ type: "FROM_CHATGPT_SCRIPT", text: text });
            }
        }
    });

    // 4. Return Focus
    setTimeout(() => {
        report("✅ [АВТО]: Сценарий готов! Возврат в Студию...");
        focusStudio();
    }, 2000);
}

async function executeSplitCycle(scriptText, customPrefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });
    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
    
    if (!geminiTab) {
        report("❌ Gemini не найден. Откройте gemini.google.com");
        return;
    }

    report("🤖 [АВТО]: Переход в Gemini для разделения сценария...");
    await chrome.windows.update(geminiTab.windowId, { focused: true });
    await chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(1500);

    // 1. Insert and Send
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: (text, prefix) => {
            const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor') || document.querySelector('textarea');
            if (editor) {
                const finalInstruction = (prefix && prefix.trim()) ? prefix : "Please split this script into a chronological list of detailed image prompts for an animation. Format each line as 'Prompt N: [Description]'.";
                const fullPrompt = finalInstruction + "\n\n" + text;
                
                editor.focus();
                document.execCommand('insertText', false, fullPrompt);
                if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
                    editor.value = fullPrompt;
                }
                ['input', 'change', 'blur'].forEach(e => editor.dispatchEvent(new Event(e, { bubbles: true })));

                setTimeout(() => {
                    const sendBtn = document.querySelector('button[aria-label*="Send"], button[aria-label*="Отправить"], .send-button');
                    if (sendBtn) sendBtn.click();
                }, 800);
            }
        },
        args: [scriptText, customPrefix]
    });

    // 2. Wait for completion
    report("⌛ [АВТО]: Ожидание разделения сценария в Gemini...");
    
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const poll = () => new Promise(resolve => {
                const interval = setInterval(() => {
                    // Gemini completion indicator: 'Stop' button becomes 'Send' button or similar
                    // or checking for the latest response element
                    const stopBtn = document.querySelector('button[aria-label*="Stop"], button[aria-label*="Остановить"]');
                    if (!stopBtn) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 2000);
            });
            await poll();

            // 3. Scrape the response
            const responses = document.querySelectorAll('.model-response-text, .message-content');
            if (responses.length > 0) {
                const lastResponse = responses[responses.length - 1];
                const text = lastResponse.innerText || lastResponse.textContent;
                chrome.runtime.sendMessage({ type: "FROM_CHATGPT_SCRIPT", text: text }); // We use the same message type for consistency in app.js
            }
        }
    });

    // 4. Return Focus
    setTimeout(() => {
        report("✅ [АВТО]: Разделение завершено! Возврат в Студию...");
        focusStudio();
    }, 2000);
}

async function executeGrokCycle(promptText, assets, assetIds) {
... (keep existing functions) ...
    if (isRunningGrokCycle) return;
    isRunningGrokCycle = true;
    try {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });
        const tabs = await chrome.tabs.query({});
        const grokTab = tabs.find(t => t.url && (t.url.includes("grok.com") || t.url.includes("x.com/i/grok") || t.url.includes("twitter.com/i/grok")));
        
        if (!grokTab) {
            report("❌ Grok не найден. Откройте grok.com/imagine");
            return;
        }

        report("🎬 Переход в Grok...");
        await chrome.windows.update(grokTab.windowId, { focused: true });
        await chrome.tabs.update(grokTab.id, { active: true });
        await sleep(1500);

        // 1. Insert image
        if (assets && assets.length > 0) {
            report("🖼️ Вставка кадра в Grok...");
            await chrome.scripting.executeScript({
                target: { tabId: grokTab.id },
                func: async (imgs) => {
                    const ed = document.querySelector('div[contenteditable="true"]') || 
                               document.querySelector('[data-testid="messageInputControls"] div[role="textbox"]') ||
                               document.querySelector('aside div[role="textbox"]');
                    if (!ed) return;
                    ed.focus();
                    
                    for (const b64 of imgs) {
                        try {
                            const blob = await (await fetch(b64)).blob();
                            const file = new File([blob], "frame.png", { type: blob.type });
                            const dt = new DataTransfer();
                            dt.items.add(file);
                            ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
                            await new Promise(r => setTimeout(r, 1500));
                        } catch (e) { console.error("Grok Paste Error:", e); }
                    }
                },
                args: [assets]
            });
            await sleep(2000);
        }

        // 2. Insert Prompt
        report("✏️ Вставка промпта...");
        await chrome.scripting.executeScript({
            target: { tabId: grokTab.id },
            func: (text) => {
                const ed = document.querySelector('div[contenteditable="true"]') || 
                           document.querySelector('[data-testid="messageInputControls"] div[role="textbox"]') ||
                           document.querySelector('aside div[role="textbox"]');
                if (!ed) return;
                ed.focus();
                document.execCommand('insertText', false, text);
                ['input', 'change'].forEach(e => ed.dispatchEvent(new Event(e, { bubbles: true })));
            },
            args: [promptText]
        });
        await sleep(1500);

        // 3. Send
        report("✈️ Отправка в Grok...");
        await chrome.scripting.executeScript({
            target: { tabId: grokTab.id },
            func: () => {
                const btn = document.querySelector('[data-testid="grok-send-button"]') || 
                            document.querySelector('button[aria-label*="Send"]') ||
                            document.querySelector('button[aria-label*="Отправить"]') ||
                            Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Grok') || b.querySelector('svg'));
                if (btn) btn.click();
            }
        });

        // 4. Wait and trigger next
        report("⌛ Генерация анимации... (60 сек)");
        for (let i = 60; i > 0; i--) {
            await sleep(1000);
        }

        report("✅ Анимация готова! Перехожу к следующему...");
        relayToStudio({ type: "FROM_GROK_AUTO_DONE" });
        
    } catch (e) {
        relayToStudio({ type: "ANIMTUBE_STATUS", text: "❌ Ошибка Grok: " + e.message });
    } finally {
        isRunningGrokCycle = false;
    }
}

async function executeLiteralCycle(promptText, assets, assetIds, prevFrame) {
    if (isLiteralCycleRunning) return;
    isLiteralCycleRunning = true;
    try {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });
        const tabs = await chrome.tabs.query({});
        const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
        if (!geminiTab) return;
        
        await chrome.windows.update(geminiTab.windowId, { focused: true });
        await chrome.tabs.update(geminiTab.id, { active: true });
        await sleep(1000);

        // 1. Insert ALL IMAGES first (Reference + Assets)
        let allImages = [];
        if (prevFrame) allImages.push(prevFrame);
        if (assets && assets.length > 0) allImages.push(...assets);

        if (allImages.length > 0) {
            report(`🖼️ Вставка изображений (${allImages.length})...`);
            await chrome.scripting.executeScript({
                target: { tabId: geminiTab.id },
                func: async (imgs) => {
                    const ed = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                    if (!ed) return;
                    ed.focus();
                    
                    for (const b64 of imgs) {
                        try {
                            const blob = await (await fetch(b64)).blob();
                            const file = new File([blob], "image.png", { type: blob.type });
                            const dt = new DataTransfer(); 
                            dt.items.add(file);
                            ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
                            await new Promise(r => setTimeout(r, 1200)); 
                        } catch(e) { console.error("Asset Paste Error:", e); }
                    }
                },
                args: [allImages]
            });
            await sleep(2000);
        }

        // 2. Insert Prompt Text
        report("✏️ Вставка промпта...");
        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: (text) => {
                const ed = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                if (!ed) return;
                ed.focus();
                
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(ed);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                
                document.execCommand('insertText', false, "\n\n" + text);
                ['input', 'change'].forEach(e => ed.dispatchEvent(new Event(e, { bubbles: true })));
            },
            args: [promptText]
        });
        await sleep(1500);

        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: async () => {
                await new Promise(r => setTimeout(r, 2000));
                const btn = document.querySelector('button[aria-label*="Send"]') || 
                            document.querySelector('button[aria-label*="Отправить"]') || 
                            document.querySelector('.send-button') ||
                            Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg path[d*="M2.01 21L23 12 2.01 3"]'));
                if (btn) btn.click();
            }
        });

        for (let i = 120; i > 0; i--) {
            report(`⌛ Генерация... (${i} сек)`);
            await sleep(1000);
        }

        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const allImgs = Array.from(document.querySelectorAll('img'));
                const frames = allImgs.filter(img => (img.naturalWidth || img.clientWidth) > 200);
                if (frames.length > 0) {
                    const img = frames[frames.length - 1];
                    img.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(500);
                    img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    img.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    await sleep(1800);
                    let p = img;
                    for (let i = 0; i < 7; i++) { if (p.parentElement) p = p.parentElement; }
                    const copyBtn = p.querySelector('button[aria-label*="Copy"], button[aria-label*="Копировать"]');
                    if (copyBtn) copyBtn.click();
                    try {
                        const res = await fetch(img.src);
                        const blob = await res.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => chrome.runtime.sendMessage({ type: "FROM_GEMINI", base64: reader.result });
                        reader.readAsDataURL(blob);
                    } catch(e) {}
                }
            }
        });

    } catch (e) {
        relayToStudio({ type: "ANIMTUBE_STATUS", text: "❌ Ошибка: " + e.message });
    } finally { 
        isLiteralCycleRunning = false; 
    }
}

function relayToStudio(msg) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const isStudio = tab.url && (tab.url.includes("localhost") || tab.url.includes("127.0.0.1") || (tab.title && tab.title.includes("AnimTube")) || (tab.url.includes("file://") && tab.title && tab.title.includes("AnimTube")));
            if (isStudio) { try { chrome.tabs.sendMessage(tab.id, msg).catch(() => {}); } catch (e) {} }
        });
    });
}

function focusStudio() {
    chrome.tabs.query({}, (tabs) => {
        const t = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || (t.title && t.title.includes("AnimTube")) || (t.url.includes("file://") && t.title && t.title.includes("AnimTube"))));
        if (t && t.id) { 
            chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
            chrome.tabs.update(t.id, { active: true }).catch(() => {});
        }
    });
}
