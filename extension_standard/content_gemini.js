// CHATGPT AUTOMATOR
console.log("✅ ChatGPT Bridge: Active");

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "ANIMTUBE_CMD_GRAB") {
        console.log("🎯 Grab request received.");
        grabLatestImage();
    }
});

function reportStatus(text) {
    chrome.runtime.sendMessage({ type: "ANIMTUBE_STATUS", text });
}

async function grabLatestImage() {
    reportStatus("🔍 Ищу последний кадр...");

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const allImgs = Array.from(document.querySelectorAll('img'));
    const candidates = allImgs.filter(img => {
        const w = img.naturalWidth || img.clientWidth;
        const h = img.naturalHeight || img.clientHeight;
        return w > 200 && h > 200;
    });

    if (candidates.length === 0) {
        reportStatus("❌ Кадр не найден на странице.");
        return;
    }

    const img = candidates[candidates.length - 1];

    reportStatus("🖱️ Симулирую наведение...");
    img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    img.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(700);

    let parent = img;
    for (let i = 0; i < 7; i++) {
        if (parent.parentElement) parent = parent.parentElement;
    }
    const copyBtn = parent.querySelector('button[aria-label*="Copy"], button[aria-label*="Копировать"]');
    if (copyBtn) {
        copyBtn.click();
        reportStatus("✅ Кнопка 'Копировать' нажата!");
    }

    try {
        const c = img.parentElement;
        if (c) {
            if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
            const ov = document.createElement('div');
            ov.innerText = "📦 В СТУДИЮ...";
            ov.style.cssText = "position:absolute;top:10px;left:10px;background:#10b981;color:white;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:800;z-index:99999;font-family:sans-serif;";
            c.appendChild(ov);
            setTimeout(() => ov.remove(), 3000);
        }
    } catch (e) {}

    reportStatus("📤 Отправляю кадр в Студию...");
    try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            chrome.runtime.sendMessage({ type: "FROM_CHATGPT", base64: reader.result });
            reportStatus("✅ Кадр отправлен!");
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        reportStatus("❌ Ошибка загрузки: " + e.message);
    }
}
