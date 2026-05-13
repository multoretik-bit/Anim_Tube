console.log("🛰️ AnimTube Bridge (SUPER AUTO) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    
    // Auto extension version handles AUTO commands, Grok commands, and Script/Split commands
    if (!event.data.type.includes("AUTO") && !event.data.type.includes("TO_GROK") && !event.data.type.includes("CMD_SCRIPT") && !event.data.type.includes("CMD_SPLIT")) return;
    
    console.log("🛰️ [BRIDGE] Received AUTO message in Content Script:", event.data.type);

    let internalMsg = {
        prompt: event.data.prompt || "",
        assets: event.data.assets || [],
        assetIds: event.data.assetIds || [],
        prefix: event.data.prefix || "",
        script: event.data.script || ""
    };

    if (event.data.type.includes("TO_GEMINI")) {
        internalMsg.type = "TO_GEMINI";
        internalMsg.image = event.data.image || null; 
        internalMsg.prevFrame = event.data.prevFrame || null;
    }
    else if (event.data.type.includes("FEEDBACK_TO_GEMINI")) {
        internalMsg.type = "FEEDBACK_TO_GEMINI";
        internalMsg.image = event.data.image || null;
    }
    else if (event.data.type.includes("TO_CHATGPT")) internalMsg.type = "TO_CHATGPT";
    else if (event.data.type.includes("TO_GROK")) internalMsg.type = "TO_GROK";
    else if (event.data.type.includes("_CMD_SCRIPT")) internalMsg.type = "ANIMTUBE_CMD_SCRIPT";
    else if (event.data.type.includes("_CMD_SPLIT")) internalMsg.type = "ANIMTUBE_CMD_SPLIT";
    else if (event.data.type.includes("ANIMTUBE_AUTO_CMD")) internalMsg.type = "TO_GEMINI"; 

    if (internalMsg.type) {
        console.log("✈️ [BRIDGE] Forwarding AUTO to Background:", internalMsg.type);
        chrome.runtime.sendMessage(internalMsg);
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "FROM_GROK_DONE") {
        msg.type = "FROM_GROK_AUTO_DONE";
    }
    window.postMessage(msg, "*");
});
