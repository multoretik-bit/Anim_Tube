// AnimTube Bridge v1.3.5 - Hybrid (ChatGPT + Gemini) - AUTO VERSION
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TO_CHATGPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "TO_GEMINI") {
        executeLiteralCycle(request.prompt, request.assets, request.assetIds);
    } else if (request.type === "ANIMTUBE_CMD_SCRIPT") {
        executeScriptCycle(request.prefix);
    } else if (request.type === "ANIMTUBE_CMD_SPLIT") {
        executeSplitCycle(request.script, request.prefix);
    } else if (request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    } else if (request.type === "FROM_GEMINI") {
        relayToStudio(request);
        setTimeout(() => {
            focusStudio();
            setTimeout(() => relayToStudio({ type: "ANIMTUBE_CMD_PASTE_AUTO" }), 3000);
        }, 3000); 
    } else if (request.type === "FROM_CHATGPT") {
        relayToStudio(request);
    }
    return true;
});

async function executeSplitCycle(scriptText, customPrefix) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (text) => chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: text });

    report("🤖 РОБОТ: Запуск разделения сценария на промпты (Gemini)...");

    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));

    if (!geminiTab) {
        report("❌ Gemini не открыт. Откройте его и попробуйте снова.");
        return;
    }

    chrome.tabs.update(geminiTab.id, { active: true });
    await sleep(1500);

    report("⌨️ Ввод сценария и инструкции по разделению...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: (text, prefix) => {
            const editor = document.querySelector(".ql-editor") || document.querySelector("input") || document.querySelector("textarea");
            if (editor) {
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

    const waitTime = 60;
    for (let i = waitTime; i >= 0; i--) {
        report(`⌛ Gemini создает кадры... (${i}с)`);
        await sleep(1000);
    }

    report("📋 Копирование промптов из Gemini...");
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await sleep(1000);
            const copyButtons = document.querySelectorAll('button[aria-label*="Copy"], button[title*="Copy"], .copy-button');
            if (copyButtons.length > 0) {
                const lastCopyBtn = copyButtons[copyButtons.length - 1];
                lastCopyBtn.click();
                return "CLICKED";
            }
            return "NOT_FOUND";
        }
    });

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
        relayToStudio({ type: "FROM_GEMINI_PROMPTS", text: parsedText });
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
    
    await chrome.windows.update(aiTab.windowId, { focused: true });
    await chrome.tabs.update(aiTab.id, { active: true });
    await sleep(1500); 

    report("✏️ Ввожу запрос для сценария (ChatGPT)...");
    await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async (text) => {
            const editor = document.querySelector('#prompt-textarea');
            if (editor) {
                editor.focus();
                editor.value = "";
                document.execCommand('insertText', false, text);
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 800));
                const sendBtn = document.querySelector('[data-testid="send-button"]');
                if (sendBtn) sendBtn.click();
            }
        },
        args: [prefix]
    });

    for (let i = 90; i > 0; i--) {
        report(`⏳ Ожидание сценария: ${i} сек...`);
        await sleep(1000);
        if (i % 30 === 0) chrome.tabs.update(aiTab.id, { active: true });
    }

    report("📋 Поиск ответа в ChatGPT...");
    const scriptCapture = await chrome.scripting.executeScript({
        target: { tabId: aiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < 3; i++) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await sleep(500);
            }
            const copyBtns = document.querySelectorAll('button[aria-label="Copy"]');
            const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
            let capturedText = "";
            if (responses.length > 0) {
                const lastRes = responses[responses.length - 1];
                capturedText = lastRes.innerText || lastRes.textContent;
            }
            if (copyBtns.length > 0) {
                copyBtns[copyBtns.length - 1].click();
                chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text: "✅ Текст скопирован." });
            } else if (capturedText) {
                await navigator.clipboard.writeText(capturedText.trim());
            }
            return capturedText.trim();
        }
    });

    const fullScriptText = scriptCapture[0].result;
    await sleep(1500);
    focusStudio();
    await sleep(800);

    if (fullScriptText) {
        relayToStudio({ type: "FROM_CHATGPT_SCRIPT", text: fullScriptText });
        report("✅ ЦИКЛ ЗАВЕРШЕН. Сценарий вставлен!");
    } else {
        report("❌ Ошибка: Сценарий не захвачен.");
    }
}

async function executeLiteralCycle(promptText, assets, assetIds) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const report = (msg) => relayToStudio({ type: "ANIMTUBE_STATUS", text: msg });

    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
    const studioTab = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));

    if (!geminiTab) {
        report("❌ Ошибка: Вкладка Gemini не найдена!");
        return;
    }

    if (studioTab) {
        chrome.windows.update(studioTab.windowId, { focused: true });
        chrome.tabs.update(studioTab.id, { active: true });
        report("📋 Студия: Готовлю текст к копированию...");
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] });
        await sleep(3500);
        report("✅ Промт в буфере! Перехожу в Gemini...");
    }

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
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                if (editor.tagName === "DIV") editor.innerText = text;
                else editor.value = text;
                ['input', 'change', 'keydown', 'keyup', 'blur'].forEach(t => editor.dispatchEvent(new Event(t, { bubbles: true })));
                if (editor.innerText.length < 5) document.execCommand('insertText', false, text);
            }
        },
        args: [promptText]
    });

    await sleep(3000);

    if (studioTab) {
        chrome.windows.update(studioTab.windowId, { focused: true });
        chrome.tabs.update(studioTab.id, { active: true });
        report(`🔄 Возвращаюсь в Студию для копирования промта...`);
        relayToStudio({ type: "ANIMTUBE_CMD_VISUAL_COPY", assetIds: assetIds || [] }); 
        await sleep(3500);
        report("✅ Промт скопирован. Перехожу в Gemini для вставки...");
    }

    chrome.windows.update(geminiTab.windowId, { focused: true });
    chrome.tabs.update(geminiTab.id, { active: true });
    report("🤔 Возврат в Gemini. Вставка ассетов...");
    await sleep(3000);

    if (assets && assets.length > 0) {
        await chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: async (imageAssets) => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                if (editor) {
                    for (const base64 of imageAssets) {
                        try {
                            const parts = base64.split(';base64,');
                            if (parts.length < 2) continue;
                            const blob = await (await fetch(base64)).blob();
                            const file = new File([blob], "asset.png", { type: blob.type });
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            editor.focus();
                            editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true }));
                            await sleep(2000);
                        } catch (e) {}
                    }
                }
            },
            args: [assets]
        });
    }

    await sleep(1000);
    await chrome.scripting.executeScript({
        target: { tabId: geminiTab.id },
        func: async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            const sendBtn = document.querySelector('button[aria-label*="Send"]') || document.querySelector('button[aria-label*="Отправить"]');
            if (sendBtn) sendBtn.click();
            await sleep(81000);
            const allImgs = Array.from(document.querySelectorAll('img'));
            const frames = allImgs.filter(img => (img.naturalWidth || img.clientWidth) > 200);
            if (frames.length > 0) {
                const img = frames[frames.length - 1];
                img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await sleep(1800);
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
