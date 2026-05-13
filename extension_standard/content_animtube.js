console.log("🛰️ AnimTube Bridge (STANDARD) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    
    // Standard extension version ONLY handles non-AUTO commands
    if (event.data.type.includes("AUTO") && !event.data.type.includes("CMD_SPLIT") && !event.data.type.includes("CMD_SCRIPT")) return;

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

    if (data.type === "TO_GEMINI" || data.type === "AUTO_TO_GEMINI") {
        internalMsg = {
            type: "TO_GEMINI",
            msgId: data.msgId,
            prompt: data.prompt || "",
            assets: data.assets || [],
            assetIds: data.assetIds || [],
            prevFrame: data.prevFrame || null
        };
    }
    else if (data.type === "FEEDBACK_TO_GEMINI") {
        internalMsg = {
            type: "FEEDBACK_TO_GEMINI",
            msgId: data.msgId,
            image: data.image || null
        };
    }
    else if (data.type === "TO_CHATGPT") {
        internalMsg = {
            type: "TO_CHATGPT",
            msgId: data.msgId,
            prompt: data.prompt || "",
            assets: data.assets || [],
            assetIds: data.assetIds || []
        };
    }
    else if (data.type === "ANIMTUBE_CMD_SCRIPT" || data.type === "ANIMTUBE_AUTO_CMD_SCRIPT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SCRIPT",
            msgId: data.msgId,
            prefix: data.prefix || ""
        };
    }
    else if (data.type === "ANIMTUBE_CMD_SPLIT" || data.type === "ANIMTUBE_AUTO_CMD_SPLIT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SPLIT",
            msgId: data.msgId,
            script: data.script || "",
            prefix: data.prefix || ""
        };
    }
    else if (data.type === "TO_GROK") {
        internalMsg = {
            type: "TO_GROK",
            msgId: data.msgId,
            prompt: data.prompt || "",
            assets: data.assets || [],
            assetIds: data.assetIds || []
        };
    }

    if (internalMsg) {
        console.log("✈️ [BRIDGE] Forwarding to Background (Standard):", internalMsg.type);
        chrome.runtime.sendMessage(internalMsg);
    }
}

chrome.runtime.onMessage.addListener((msg) => {
    window.postMessage(msg, "*");
});
