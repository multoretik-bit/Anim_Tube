console.log("🛰️ AnimTube Bridge (STANDARD) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    
    // Standard extension version ONLY handles non-AUTO commands
    if (event.data.type.includes("AUTO") && !event.data.type.includes("CMD_SPLIT") && !event.data.type.includes("CMD_SCRIPT")) return;

    // Cross-extension deduplication check: if another extension already claimed this msgId, skip.
    if (event.data.msgId && sessionStorage.getItem('animtube_msg_lock_' + event.data.msgId)) {
        return;
    }
    
    let internalMsg = null;

    if (event.data.type === "TO_GEMINI" || event.data.type === "AUTO_TO_GEMINI") {
        internalMsg = {
            type: "TO_GEMINI",
            msgId: event.data.msgId,
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || [],
            prevFrame: event.data.prevFrame || null
        };
    }
    else if (event.data.type === "FEEDBACK_TO_GEMINI") {
        internalMsg = {
            type: "FEEDBACK_TO_GEMINI",
            msgId: event.data.msgId,
            image: event.data.image || null
        };
    }
    else if (event.data.type === "TO_CHATGPT") {
        internalMsg = {
            type: "TO_CHATGPT",
            msgId: event.data.msgId,
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        };
    }
    else if (event.data.type === "ANIMTUBE_CMD_SCRIPT" || event.data.type === "ANIMTUBE_AUTO_CMD_SCRIPT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SCRIPT",
            msgId: event.data.msgId,
            prefix: event.data.prefix || ""
        };
    }
    else if (event.data.type === "ANIMTUBE_CMD_SPLIT" || event.data.type === "ANIMTUBE_AUTO_CMD_SPLIT") {
        internalMsg = {
            type: "ANIMTUBE_CMD_SPLIT",
            msgId: event.data.msgId,
            script: event.data.script || "",
            prefix: event.data.prefix || ""
        };
    }
    else if (event.data.type === "TO_GROK") {
        internalMsg = {
            type: "TO_GROK",
            msgId: event.data.msgId,
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        };
    }

    if (internalMsg) {
        // Claim the message
        if (event.data.msgId) {
            sessionStorage.setItem('animtube_msg_lock_' + event.data.msgId, 'true');
            setTimeout(() => sessionStorage.removeItem('animtube_msg_lock_' + event.data.msgId), 60000);
        }
        console.log("✈️ [BRIDGE] Forwarding to Background (Standard):", internalMsg.type);
        chrome.runtime.sendMessage(internalMsg);
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    window.postMessage(msg, "*");
});
