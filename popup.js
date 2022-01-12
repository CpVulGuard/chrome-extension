let loginForm = document.forms["loginForm"];
loginForm.addEventListener('submit', (event) => {
    handleLoginForm(event);
});
let logInStatus = document.getElementById("logInStatus-Notification");
let logOutLink = document.getElementById("logOutLink");
logOutLink.addEventListener('click', (event) => {
    logOut(event);
});

document.getElementById("forgot-password-link").addEventListener('click', () => {
    chrome.tabs.create({active: true, url: "https://cpvulguard.it-sec.medien.hs-duesseldorf.de/forgot-password"});
});

document.getElementById("register-link").addEventListener('click', () => {
    chrome.tabs.create({active: true, url: "https://cpvulguard.it-sec.medien.hs-duesseldorf.de/register"});
});

displayStatus();


function displayStatus(){
    chrome.runtime.sendMessage("getCookie", function(bearer){
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

    login('https://cpvulguard.it-sec.medien.hs-duesseldorf.de/token',{
        "email": loginForm['email'].value,
        "password": loginForm['pass'].value
    })
}

function logOut(event) {
    event.preventDefault();
    chrome.storage.local.remove(['secadvisor'], function(resp){
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
        chrome.storage.local.set({"secadvisor": data.access_token});
        displayStatus();
    })
    .catch(error => {
        console.error('Error:', error);
    });
    
}