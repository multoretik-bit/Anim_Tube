// === AnimTube Studio v2.0 - Utility Helpers ===

export function logStatus(msg, type) {
    console.log(`[STATUS] (${type}): ${msg}`);
    const terminal = document.getElementById('studio-terminal') || document.getElementById('receiving-text');
    if (!terminal) return;
    
    if (terminal.id === 'receiving-text') {
        terminal.innerText = msg.toUpperCase();
        return;
    }

    const entry = document.createElement('div');
    entry.style.color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#6366f1');
    entry.style.marginBottom = '4px';
    entry.innerHTML = `<span style="opacity:0.4">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

export async function compressImage(base64, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = base64;
    });
}

export function isAssetMatch(prompt, assetName) {
    if (!prompt || !assetName) return false;
    const p = prompt.toLowerCase();
    const n = assetName.toLowerCase().trim();
    if (p.includes(n)) return true;
    const words = n.split(/\s+/).filter(w => w.length >= 2);
    if (words.length > 1) {
        return words.every(word => {
            const root = word.replace(/(ий|ый|ой|ая|яя|ое|ее|ую|юю|ых|их|ими|ыми|ого|его|ому|ему|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|й|ь)$/, '');
            if (root.length < 3) return p.includes(word);
            return new RegExp(root, 'i').test(p);
        });
    }
    const root = n.replace(/(ий|ый|ой|ая|яя|ое|ее|ую|юю|ых|их|ими|ыми|ого|его|ому|ему|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|й|ь)$/, '');
    if (root.length < 3) return p.includes(n);
    return new RegExp(root, 'i').test(p);
}

export function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return;
    }
    navigator.clipboard.writeText(text);
}
