let loginForm = document.forms["loginForm"];
let logInStatus = document.getElementById("logInStatus-Notification");
let logOutLink = document.getElementById("logOutLink");

let baseUrl;
chrome.storage.sync.get({
    localServer: false,
}, function(items) {
    baseUrl = items.localServer ? 'http://localhost:8000/' : 'https://cpvulguard.it-sec.medien.hs-duesseldorf.de/';

    loginForm.addEventListener('submit', (event) => {
        handleLoginForm(event);
    });
    logOutLink.addEventListener('click', (event) => {
        logOut(event);
    });

    document.getElementById("forgot-password-link").addEventListener('click', () => {
        chrome.tabs.create({active: true, url: baseUrl + 'forgot-password'});
    });
    document.getElementById("register-link").addEventListener('click', () => {
        chrome.tabs.create({active: true, url: baseUrl + 'register'});
    });

    displayStatus();
});

function displayStatus(){
    chrome.runtime.sendMessage({name: "getCookie", sessionKey: btoa(baseUrl)}, function(bearer){
        if(bearer && Object.keys(bearer).length !== 0){
            loginForm.classList.add('invisible');
            logInStatus.classList.remove('invisible');
            logOutLink.classList.remove('invisible');
        }else{
            loginForm.classList.remove('invisible');
            logInStatus.classList.add('invisible');
            logOutLink.classList.add('invisible');
        }
    });
}

function handleLoginForm(event) {
    event.preventDefault();
    loginForm['submitButton'].classList.add('btn_loading');

    login(baseUrl + 'token',{
        "email": loginForm['email'].value,
        "password": loginForm['pass'].value
    })
}

function logOut(event) {
    event.preventDefault();
    chrome.storage.local.remove([`secadvisor${btoa(baseUrl)}`], function(resp){
        loginForm['submitButton'].classList.remove('btn_loading');
        displayStatus();
    });
}

function login(url, credentials) {
    fetch(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        body: new URLSearchParams((credentials)),
    })
    .then(response => response.json())
    .then(data => {
        chrome.storage.local.set({[`secadvisor${btoa(baseUrl)}`]: data.access_token});
        displayStatus();
    })
    .catch(error => {
        console.error('Error:', error);
    });
    
}