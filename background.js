init();


/**
 * Fügt der Extension die benötigten Listener hinzu
 */
function init(){
    chrome.tabs.onUpdated.addListener(function(tabId,info, tab) {
        if (info.status == "complete") {
           if(isOnStackOverflow(tab.url)){
                loadForeground(tabId)
           }
        }
    });

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if(request === "getCookie") {
            chrome.storage.local.get(['secadvisor'], function(token){
                sendResponse(token);
            });
        }
        return true;
    });
}

/**
 * Gibt an ob es sich bei der URL um eine StackOverflow URL handelt
 * @param {String} url die URL der Website
 * @returns ob die Website StackOverflow ist
 */
function isOnStackOverflow(url){
    return (/^https:\/\/stackoverflow/.test(url));
}

/**
 * Lädt das Foreground-Skript und fügt alle wichtigen CSS dateien der Website hinzu
 */
function loadForeground(tabId){
    chrome.scripting.executeScript({
        target: {tabId: tabId}, 
        files: ['./foreground.js']
    });
    chrome.scripting.insertCSS({
        files: ['./stylesheets/custom.css'],
        target: {tabId: tabId}
    });
}