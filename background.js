console.log('Started background.js');
init();


/**
 * Fügt der Extension die benötigten Listener hinzu
 */
function init(){
    chrome.tabs.onUpdated.addListener(function(tabId,info, tab) {
        if (info.status == "complete") {
           console.log("Info:", info, tabId, tab)
           if(isOnStackOverflow(tab.url)){
                loadForeground(tabId)
           }
        }
    });

    //Skripte wollen den LogIn-Token erhalten
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            console.log((sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension")+"\n"+"Command: "+request.command);

            if (request.command === "getToken"){
                chrome.storage.local.get(['token'], function(token){
                    console.log("Loaded token from storage: "+JSON.stringify(token));
                    sendResponse(token);
                });
            }
            else if(request.command === "setToken"){
                chrome.cookies.get({"url": "https://secadvisor.dev", "name": "Bearer"}, function(cookie){
                    let response = {token: ""};
                    if(cookie){
                        response.token = cookie.value;
                        chrome.storage.local.set({"token": response.token});
                    }
                    console.log("Loaded token in storage: "+JSON.stringify(response))
                    sendResponse(response);
                });
            }
            else if(request.command === "deleteToken"){
                chrome.cookies.remove({"url": "https://secadvisor.dev", "name": "Bearer"}, function(){
                    let response = {token: ""};
                    chrome.storage.local.set({"token": response.token});
                    console.log("Deleted Token. Token in Storage: "+JSON.stringify(response))
                    sendResponse(response);
                });
            }
            return true;
        }
      );
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
    console.log('brakgound starts foreground');
}