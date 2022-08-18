document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get({
        localServer: false,
    }, function(items) {
        document.getElementById('localServer').checked = items.localServer;
    });
});

document.getElementById('localServer').addEventListener('change', (event) => {
    chrome.storage.sync.set({
        localServer: event.currentTarget.checked
    });
})