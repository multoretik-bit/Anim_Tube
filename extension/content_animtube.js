console.log("🛰️ AnimTube Studio Bridge v11.17 - Ultimate Resurrection Ready.");

// 1. Studio -> Background (Prompt Commands)
window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;

    // Legacy extension version ONLY handles specific non-AUTO commands
    if (event.data.type.includes("AUTO")) return;

    // Cross-extension deduplication check: if another extension already claimed this msgId, skip.
    if (event.data.msgId && sessionStorage.getItem('animtube_msg_lock_' + event.data.msgId)) {
        return;
    }

    let internalMsg = null;

    if (event.data.type === "ANIMTUBE_CMD") {
        internalMsg = {
            type: "TO_GEMINI",
            msgId: event.data.msgId,
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        };
    }
    
    if (event.data.type === "ANIMTUBE_CMD_SCRIPT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SCRIPT",
            msgId: event.data.msgId,
            prefix: event.data.prefix || ""
        };
    }

    if (event.data.type === "ANIMTUBE_CMD_SPLIT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SPLIT",
            msgId: event.data.msgId,
            script: event.data.script || "",
            prefix: event.data.prefix || ""
        };
    }

    if (internalMsg) {
        // Claim the message
        if (event.data.msgId) {
            sessionStorage.setItem('animtube_msg_lock_' + event.data.msgId, 'true');
            setTimeout(() => sessionStorage.removeItem('animtube_msg_lock_' + event.data.msgId), 60000);
        }
        console.log("✈️ [BRIDGE] Forwarding to Background (Legacy):", internalMsg.type);
        chrome.runtime.sendMessage(internalMsg);
    }
});

// 2. Background -> Studio (Image Arrival & Auto-Paste Signals)
chrome.runtime.onMessage.addListener((msg) => {
    // Relay all background messages to the Studio page context
    window.postMessage(msg, "*");
});
