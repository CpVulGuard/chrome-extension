console.log('Started PopUp');
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
    chrome.tabs.create({active: true, url: "https://secadvisor.dev/forgot-password"});
});

document.getElementById("register-link").addEventListener('click', () => {
    chrome.tabs.create({active: true, url: "https://secadvisor.dev/register"});
});

displayStatus();

function displayStatus(){
    console.log("Starting displaying status");
    chrome.runtime.sendMessage({command: "getToken"}, function(response) {
        console.log('Token Response:'+JSON.stringify(response))
        let token = response.token;
        if(token){
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

    login('https://secadvisor.dev/token',{
        "email": loginForm['email'].value,
        "password": loginForm['pass'].value
    })
}

function logOut(event) {
    event.preventDefault();
    chrome.runtime.sendMessage({command: "deleteToken"}, function(){
        displayStatus();
    });
}

function login(url, credentials) {
    console.log("Starting Login");
    fetch(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        body: new URLSearchParams((credentials)),
    })
        .then(response => response.json())
        .then(data => {
            console.log("Login fetched data: "+JSON.stringify(data));
            chrome.cookies.set({
                "name": "Bearer",
                "url": "https://secadvisor.dev",
                "value": data.access_token,
                "sameSite": "lax"
            }, function(){
                console.log("Sending data to backend");
                chrome.runtime.sendMessage({command: "setToken"}, function(){
                    loginForm['submitButton'].classList.remove('btn_loading');
                    displayStatus();
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}