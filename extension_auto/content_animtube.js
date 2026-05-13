console.log("🛰️ AnimTube Bridge (SUPER AUTO) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    
    // Auto extension version handles AUTO commands, Grok commands, and Script/Split commands
    if (!event.data.type.includes("AUTO") && !event.data.type.includes("TO_GROK") && !event.data.type.includes("ANIMTUBE_GROK_AUTO_COMMAND") && !event.data.type.includes("CMD_SCRIPT") && !event.data.type.includes("CMD_SPLIT")) return;

    // Cross-extension deduplication using sessionStorage (only for types we handle)
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
        return; // Return early, processing continues in setTimeout
    }
    
    processMessage(event.data);
});

function processMessage(data) {
    console.log("🛰️ [BRIDGE] Received message in Content Script:", data.type);

    let internalMsg = {
        prompt: data.prompt || "",
        assets: data.assets || [],
        assetIds: data.assetIds || [],
        prefix: data.prefix || "",
        script: data.script || "",
        msgId: data.msgId // Pass through the ID
    };

    if (data.type.includes("TO_GEMINI")) {
        internalMsg.type = "TO_GEMINI";
        internalMsg.image = data.image || null; 
        internalMsg.prevFrame = data.prevFrame || null;
    }
    else if (data.type.includes("FEEDBACK_TO_GEMINI")) {
        internalMsg.type = "FEEDBACK_TO_GEMINI";
        internalMsg.image = data.image || null;
    }
    else if (data.type.includes("TO_CHATGPT")) internalMsg.type = "TO_CHATGPT";
    else if (data.type === "ANIMTUBE_GROK_AUTO_COMMAND") {
        internalMsg.type = "TO_GROK";
        internalMsg.msgId = data.msgId;
    }
    else if (data.type.includes("_CMD_SCRIPT")) internalMsg.type = "ANIMTUBE_CMD_SCRIPT";
    else if (data.type.includes("_CMD_SPLIT")) internalMsg.type = "ANIMTUBE_CMD_SPLIT";
    else if (data.type.includes("ANIMTUBE_AUTO_CMD")) internalMsg.type = "TO_GEMINI"; 

    if (internalMsg.type) {
        console.log("✈️ [BRIDGE] Forwarding to Background:", internalMsg.type, internalMsg.msgId || "");
        chrome.runtime.sendMessage(internalMsg);
    }
}
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "FROM_GROK_DONE") {
        msg.type = "FROM_GROK_AUTO_DONE";
    }
    window.postMessage(msg, "*");
});
