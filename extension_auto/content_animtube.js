console.log("🛰️ AnimTube Bridge (SUPER AUTO) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data) return;
    
    // Only handle AUTO commands
    if (event.data.type === "ANIMTUBE_AUTO_CMD") {
        chrome.runtime.sendMessage({
            type: "TO_CHATGPT",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        });
    }
    
    if (event.data.type === "ANIMTUBE_AUTO_CMD_SCRIPT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SCRIPT",
            prefix: event.data.prefix || ""
        });
    }

    if (event.data.type === "ANIMTUBE_AUTO_CMD_SPLIT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SPLIT",
            script: event.data.script || "",
            prefix: event.data.prefix || ""
        });
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    window.postMessage(msg, "*");
});
