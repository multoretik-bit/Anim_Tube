console.log("🛰️ AnimTube Bridge (SUPER AUTO) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    
    // Auto extension version ONLY handles AUTO commands
    if (!event.data.type.includes("AUTO")) return;
    
    // Create a normalized command for background script
    let internalMsg = {
        prompt: event.data.prompt || "",
        assets: event.data.assets || [],
        assetIds: event.data.assetIds || [],
        prefix: event.data.prefix || "",
        script: event.data.script || ""
    };

    // Mapping to standard internal types
    if (event.data.type.includes("TO_GEMINI")) internalMsg.type = "TO_GEMINI";
    else if (event.data.type.includes("TO_CHATGPT")) internalMsg.type = "TO_CHATGPT";
    else if (event.data.type.includes("TO_GROK")) internalMsg.type = "TO_GROK";
    else if (event.data.type.includes("_CMD_SCRIPT")) internalMsg.type = "ANIMTUBE_CMD_SCRIPT";
    else if (event.data.type.includes("_CMD_SPLIT")) internalMsg.type = "ANIMTUBE_CMD_SPLIT";
    else if (event.data.type.includes("ANIMTUBE_AUTO_CMD")) internalMsg.type = "TO_GEMINI"; // Legacy mapping

    if (internalMsg.type) {
        chrome.runtime.sendMessage(internalMsg);
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "FROM_GROK_DONE") {
        msg.type = "FROM_GROK_AUTO_DONE";
    }
    window.postMessage(msg, "*");
});
