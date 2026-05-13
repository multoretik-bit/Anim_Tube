console.log("🛰️ AnimTube Studio Bridge v11.17 - Ultimate Resurrection Ready.");

// 1. Studio -> Background (Prompt Commands)
window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;

    // Legacy extension version ONLY handles specific non-AUTO commands
    if (event.data.type.includes("AUTO")) return;

    // Cross-extension deduplication check
    if (event.data.msgId) {
        // Add a tiny random delay to prevent race conditions when multiple extensions check at once
        const delay = Math.floor(Math.random() * 30);
        setTimeout(() => {
            if (sessionStorage.getItem('animtube_msg_lock_' + event.data.msgId)) {
                return;
            }
            // Claim immediately
            sessionStorage.setItem('animtube_msg_lock_' + event.data.msgId, 'true');
            setTimeout(() => sessionStorage.removeItem('animtube_msg_lock_' + event.data.msgId), 60000);
            
            processMessage(event.data);
        }, delay);
        return;
    }
    
    processMessage(event.data);
});

function processMessage(data) {
    let internalMsg = null;

    if (data.type === "ANIMTUBE_CMD") {
        internalMsg = {
            type: "TO_GEMINI",
            msgId: data.msgId,
            prompt: data.prompt || "",
            assets: data.assets || [],
            assetIds: data.assetIds || []
        };
    }
    
    if (data.type === "ANIMTUBE_CMD_SCRIPT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SCRIPT",
            msgId: data.msgId,
            prefix: data.prefix || ""
        };
    }

    if (data.type === "ANIMTUBE_CMD_SPLIT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SPLIT",
            msgId: data.msgId,
            script: data.script || "",
            prefix: data.prefix || ""
        };
    }

    if (internalMsg) {
        console.log("✈️ [BRIDGE] Forwarding to Background (Legacy):", internalMsg.type);
        chrome.runtime.sendMessage(internalMsg);
    }
}

// 2. Background -> Studio (Image Arrival & Auto-Paste Signals)
chrome.runtime.onMessage.addListener((msg) => {
    // Relay all background messages to the Studio page context
    window.postMessage(msg, "*");
});
