let baseUrl;
chrome.storage.sync.get({
    localServer: false,
}, function(items) {
    baseUrl = items.localServer ? 'http://localhost:8000/' : 'https://cpvulguard.it-sec.medien.hs-duesseldorf.de/';
    startForeground();
});

async function retrieveRegexList() {
    let request = new Request(baseUrl + 'queries', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        headers: new Headers({
            'Accept': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Authorization': 'Bearer ' + await getBearer()
        })
    });
    return fetch(request).then(response => response.json())
        .catch(error => {
            console.error('Error:', error);
        });
}

let reportedPosts;
let unreportedPosts;

/**
 * Start den Prozess für die Manuipulation der Website
 */
async function startForeground() {
    var answers = [];
    var elements = document.getElementsByTagName('*');
    for (i = 0; i < elements.length; i++) {
        if (elements[i].getAttribute('data-answerid') != null || elements[i].getAttribute('data-questionid') != null) {
            answers.push(elements[i]);
        }
    }

    //Get DataBaseReport
    let idList = [];
    for (index = 0; index < answers.length; index++) {
        let id;
        if(answers[index].getAttribute('data-answerid') != null){
            id = answers[index].getAttribute('data-answerid');
        }else{
            id = answers[index].getAttribute('data-questionid');
        }
        idList.push(id);
    }

    const regexList = await retrieveRegexList();

    const bearer = await getBearer();
    if(bearer && Object.keys(bearer).length !== 0){
        postData(baseUrl + 'check', {"ids":idList})
            .then(data => {
                reportedPosts = data.reportedPosts;
                unreportedPosts = new Set(data.unreportedPosts);
                //Add Interactions
                for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
                    let codeBlocks = answers[answerIndex].getElementsByTagName('pre');
                    let id;
                    if(answers[answerIndex].getAttribute('data-answerid') != null){
                        id = answers[answerIndex].getAttribute('data-answerid');
                    }else{
                        id = answers[answerIndex].getAttribute('data-questionid');
                    }
                    for (let blockIndex = 0; blockIndex < codeBlocks.length; blockIndex++) {
                        runRealTimeAnalysis(id, codeBlocks[blockIndex], blockIndex, regexList);
                    }
                    for (let blockIndex = 0; blockIndex < codeBlocks.length; blockIndex++) {
                        addIteractionToAnswer(id, codeBlocks[blockIndex], blockIndex);
                    }
                }
        });
    }
}

/**
 * Gibt den Datenbankeintrag für einen bestimmten CodeBlock an
 * @param {String} soPostId
 * @param {Integer} codeBlockIndex 
 * @returns den Eintrag als {reason, soPostId, imported, codeBlockIndex, rows}. Der eintrag ist {} wenn nicht vorhanden.
 */
function checkPost(soPostId, codeBlockIndex) {
    let alt = {};
    for (const post of reportedPosts) {
        if(post.soPostId === parseInt(soPostId)) {
            if (post.codeBlockIndex === codeBlockIndex) {
                return post;
            }
            else if (post.codeBlockIndex === -1) {
                alt = post;
            }
        }
    }
    return alt;
}

/**
 * Gibt an ob ein CodeBlock bereits von einem andrem oder dem selben User reported wurde
 * @param {*} soPostId die ID des CodeBlocks
 * @param {*} codeBlockIndex der Index des CodeBlocks auf der Seite
 * @returns boolean ob ein Report vorliegt
 */
function isCodeBlockAlreadyReported(soPostId, codeBlockIndex) {
    const report = checkPost(soPostId, codeBlockIndex);
    return (Object.keys(report).length !== 0);
}

/**
 * Detects vulnerable code snippets in real time and marks them
 * @param soPostId post id
 * @param element code block
 * @param codeBlockIndex code block index
 * @param regexList regex list to check
 */
function runRealTimeAnalysis(soPostId, element, codeBlockIndex, regexList) {
    let postId = parseInt(soPostId);
    if (unreportedPosts.has(postId)) {
        return;
    }
    let htmlContent = element.innerHTML;
    for (const regexEntry of regexList) {
        let regex = new RegExp(regexEntry.regex, 'gs');
        let result = regex.exec(htmlContent);
        if (result === null) {
            continue;
        }
        // Doppelte Einträge mit fehlenden Codeblock- und Zeilenangaben verwerfen
        reportedPosts = reportedPosts.filter(
            entry => entry.soPostId !== postId || (entry.codeBlockIndex !== -1 && entry.codeBlockIndex !== codeBlockIndex)
        );
        reportedPosts.push({
            soPostId: postId,
            imported: 0,
            codeBlockIndex: codeBlockIndex,
            reason: regexEntry.reason,
            rows: '-1',
            realTime: true
        });
        element.innerHTML = element.innerHTML.replaceAll(regex, `$1<span class="sa_marked">$2</span>$3`)
    }
}

/**
 * Fügt einem Codeblock die Inmteraktionsfläsche hinzu
 * @param {String} soPostId die Id der Antwort des Codeblocks
 * @param {HTML-Element} element der Codeblock als HTML-Elemtent
 * @param {Integer} codeBlockIndex der Index des CodeBlocks auf der Seite
 * @param regexList Liste der regulären Ausdrücke
 */
function addIteractionToAnswer(soPostId, element, codeBlockIndex) {
        let codeBlockHeader = document.createElement('div');
        let triggerButton = document.createElement('button');
        triggerButton.classList.add('sa_isIcon');
        let popUp;

        let codeBlockCopy = generateCodeBlockCopy(element);
        if (!codeBlockCopy) {
            return;
        }
        let codeLineAmount = codeBlockCopy.getElementsByTagName('code').length;
        if(isCodeBlockAlreadyReported(soPostId, codeBlockIndex)){
            const currentPost = checkPost(soPostId, codeBlockIndex);
            if(currentPost.codeBlockIndex === codeBlockIndex || currentPost.codeBlockIndex === -1) {
                element.style.userSelect = 'none';
                element.title = 'To copy this code you need to click on the exclamation mark.';
                element.style.backgroundColor = "rgba(255,165,0, 0.5)";
                //unreport
                triggerButton.innerHTML = '<img src=' + chrome.runtime.getURL('icons/warning_icon.png') + ' />';
                triggerButton.title = 'See possible security vulnerability';

                //popupUnreport
                let descriptionUnreoprt = generateDescription(soPostId, codeBlockIndex);
                let formUnreport = generateReportForm(soPostId, codeBlockIndex, codeLineAmount, false, !!currentPost.realTime);
                markLines(codeBlockCopy, soPostId, codeBlockIndex);
                popUp = generatePopUp(triggerButton, descriptionUnreoprt, codeBlockCopy, formUnreport);
            } else {
                popUp = document.createElement('div');
            }
        }else{
            //report
            triggerButton.innerHTML = '<img src=' + chrome.runtime.getURL('icons/option_icon.png') + ' />';
            triggerButton.title = 'Report this answer.';

            //popupReport
            let description = generateDescription(soPostId, codeBlockIndex);
            let form = generateReportForm(soPostId, codeBlockIndex, codeLineAmount, true, false);
            popUp = generatePopUp(triggerButton, description, codeBlockCopy, form);
        }

        codeBlockHeader.appendChild(triggerButton);
        lienBreak = document.createElement('br');
        lienBreak.style.userSelect = 'none';
        element.insertBefore(lienBreak, element.firstChild);
        element.insertBefore(codeBlockHeader, element.firstChild);
        document.body.appendChild(popUp);
}

/**
 * Erstellt ein PopUp, welches die Interaktionsfläche der Antwort ist.
 * @param {button} trigger der Knopf, der das PopUp erscheinen lässt
 * @param {Element} inputs Alles was im PopUp sein soll
 * @returns das erstellte PopUp
 */
function generatePopUp(trigger, ...inputs) {
    let popUpBody = document.createElement('div');
    popUpBody.classList.add('sa_popUpBody')
    let popUpCloseButton = document.createElement('div');
    popUpCloseButton.classList.add('sa_popUpCloseButton');
    popUpCloseButton.innerHTML = '<img src=' + chrome.runtime.getURL('icons/close_icon.png') + ' />';
    let popUpContent = document.createElement('div');
    popUpContent.classList.add('sa_popUpContent');

    popUpBody.appendChild(popUpContent);

    for (i = 0; i < inputs.length; i++) {
        popUpContent.appendChild(inputs[i]);
    }
    popUpContent.appendChild(popUpCloseButton);

    trigger.classList.add('sa_popUpTrigger');

    trigger.addEventListener('click', () => {
        popUpBody.classList.add('sa_show');
    });
    popUpCloseButton.addEventListener('click', () => {
        popUpBody.classList.remove('sa_show');
    });

    return popUpBody;
}

/**
 * Generiert die Beschreibung für einen Codeblock
 * @param {String} soPostId die ID der Antwort des Codeblocks
 * @param {Integer} codeBlockIndex der Index des CodeBlocks auf der Seite
 * @returns die Beschreibung als HTML-div-Element
 */
function generateDescription(soPostId, codeBlockIndex) {
    let container = document.createElement('div');
    let content = document.createElement('p');
    let title = document.createElement('h1');
    title.innerText = 'Reason:'
    container.classList.add('sa_discriptionContent');

    if(isCodeBlockAlreadyReported(soPostId, codeBlockIndex)){
        container.append(title);
        content.innerText = checkPost(soPostId, codeBlockIndex).reason;
    }else{
        content.innerText = 'This code didn\'t get reported yet. It is probably safe to use.';
    }
    container.append(content);
    return container;
}

function createReactionButton(buttonText, successText, failureText){
    let button = document.createElement('button');

    let text = document.createElement('span');
    text.classList.add('sa_buttonText');
    text.innerText = buttonText;

    let success = document.createElement('span');
    success.classList.add('sa_successText');
    success.innerText = successText;
    let fail = document.createElement('span');
    fail.classList.add('sa_failText');
    fail.innerText = failureText;

    button.append(text);
    button.append(success);
    button.append(fail);
    return button;
}

/**
 * Erstellt ein Formular zum Melden von Code auf Stackoverflow
 * @param {String} soPostId die Datenbank-ID des CodeBlocks
 * @param {Integer} codeBlockIndex der Index des CodeBlocks auf der Seite
 * @param {Integer} codeLineAmount die Anzahl von Zeilen im CodeBlock
 * @param {Boolean} isReport gibt an ob ein report oder unreport gesendet wird.
 * @returns das generierte Formular zum melden von CodeBlöcken
 */
function generateReportForm(soPostId, codeBlockIndex, codeLineAmount, isReport, realTime) {
    let form = document.createElement('form');
    form.classList.add('sa_popUpForm');
    let formBody = document.createElement('fieldset');
    formBody.classList.add('sa_popUpForm');
    let formName = document.createElement('legend');
    if(isReport){
        formName.innerText = 'Report this answer';
    } else {
        formName.innerText = 'Unreport this answer';
    }
    

    //Reason-Angabe
    let reasonGroup = document.createElement('div');
    reasonGroup.classList.add('sa_popUpForm');
    let reasonLabel = document.createElement('label');
    reasonLabel.innerText = 'Reason';
    let reasonInput = document.createElement('textarea');
    reasonInput.name = 'reason';
    if(isReport){
        reasonInput.placeholder = 'e.g. This code runs the \'foo\' function, which is deprecated.';
    } else {
        reasonInput.placeholder = 'e.g. This report is false positive, as foo is used in a safe manor.';
    }

    form.setAttribute('Answerid', soPostId);
    form.setAttribute('CodeBlockIndex', codeBlockIndex);

    let reasonHelper = document.createElement('span');
    if(isReport){
        reasonHelper.innerText = 'Please describe the security-vulnerability this code hosts.';
    } else {
        reasonHelper.innerText = 'Please describe why this report is false positive.';
    }

    //Codeline-Angabe
    let lineGroup = document.createElement('div');
    let lineLabel = document.createElement('label');
    lineLabel.innerText = 'Codeline(s)';
    let lineInput = document.createElement('input');
    lineInput.placeholder = 'e.g. 1-13;15';
    lineInput.name = 'codeline';
    let lineHelper = document.createElement('span');
    lineHelper.innerText = 'Please specify the exact line(s) that host the vulnerabillity.';

    let type = document.createElement("input");
    type.setAttribute("type", "hidden");
    type.setAttribute("name", "type");
    if(isReport){
        type.setAttribute("value", "add");
    } else {
        type.setAttribute("value", "delete");
    }

    let submitButton = createReactionButton('Submit', 'Request send!', 'Request failed. Try to log out and log in again.');
    submitButton.setAttribute('type', 'submit')
    form.append(formBody);
    formBody.append(formName);

    formBody.append(reasonGroup);
    reasonGroup.append(reasonLabel);
    reasonGroup.append(reasonInput);
    reasonGroup.append(reasonHelper);

    formBody.append(lineGroup);
    lineGroup.append(lineLabel);
    lineGroup.append(lineInput);
    lineGroup.append(lineHelper);

    formBody.append(type)

    formBody.append(submitButton);

    addFormValidation(form, codeLineAmount);
    reasonInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    lineInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        handleCodeReport(form, submitButton, codeBlockIndex, realTime);
    });

    return form;
}

/**
 * Erweitert das Formular um Bedingungen
 * @param {HTML-Form} form das Formular, dass um die Bedingungen erweitert werden soll
 * @param {Integer} codeLineAmount die Anzahl von Zeilen im CodeBlock
 */
function addFormValidation(form, codeLineAmount) {
    form['reason'].addEventListener('input', function (event) {
        form['reason'].setCustomValidity(getReasonValidation(form['reason'].value));
    });
    form['codeline'].addEventListener('input', function (event) {
        form['codeline'].setCustomValidity(getCodeLineValidation(form['codeline'].value, codeLineAmount));
    });
}

/**
 * Gibt an ob eine Eingabe für das Grund-Feld okay ist
 * @param {String}  input Die Eingabe des Benutzers
 * @returns die Nachricht die dargestellt werden soll
 */
function getReasonValidation(input) {
    if (input) {
        return '';
    } else {
        return 'This field may not be empty.';
    }
}

/**
 * Gibt an, ob die Eingabe für das CodeLine-Feld okay ist
 * @param {String} input die Eingabe des Benutzers
 * @param {Integer} lineAmount wie viele Zeilen es gibt
 * @returns die Nachricht, die dargestellt werden soll
 */
function getCodeLineValidation(input, lineAmount) {
    let patter = /^([0-9]+(-[0-9]+)?)(;[0-9]+(-[0-9]+)?)*$/;
    if (!input) {
        return 'This field may not be empty.';
    }
    if (patter.test(input)) {
        let lines = input.split(';');
        for (var index = 0; index < lines.length; index++) {
            if ((lines[index] + "").indexOf('-') !== -1) {
                let lowerBound = parseInt(lines[index].split('-')[0]);
                let upperBound = parseInt(lines[index].split('-')[1]);
                if (lowerBound >= upperBound) {
                    return '\'' + lines[index] + '\' is invalid because ' + upperBound + ' is not greater than ' + lowerBound;
                }
                if (upperBound > lineAmount) {
                    return upperBound + ' is invalid because there are only ' + lineAmount + ' lines';
                }
                if (lowerBound < 1) {
                    return lowerBound + ' is invalid because it starts a line 1';
                }
            } else {
                if (parseInt(lines[index]) > lineAmount) {
                    return lines[index] + ' is invalid because there are only ' + lineAmount + ' lines';
                }
                if (parseInt(lines[index]) < 1) {
                    return lines[index] + ' is invalid because it starts a line 1';
                }
            }
        }
        return '';
    } else {
        return 'This field does not match the correct pattern:' + '\n'
            + 'Only use numbers and the following characters: \';\' and \'-\'.' + '\n'
            + 'You can specify one line (e.g. \'5\') or specify multiple lines at once (e.g. \'1-5\').' + '\n'
            + 'Concatenate your specifications with \';\'. Do not enter a \';\' without a following specification.';
    }
}

function markLines(codeBlock, soPostId, codeBlockIndex){
    let post = checkPost(soPostId, codeBlockIndex);
    if(post.rows) {
        let rows = getLineList(post.rows)
        let htmlRows = codeBlock.getElementsByTagName('code');

        for(let index = 0; index < rows.length; index++){
            htmlRows.item(rows[index]-1).classList.add('sa_marked');
        }
    }
}

/**
 * Konvertiert die Eingabe des Benutzers im CodeLines-Feld in eine Liste
 * @param {String} input Die Eingabe des Benutzers
 * @returns eine Liste mit den Zeilen
 */
function getLineList(input) {
    let values = [];
    let lines = input.split(';');
    for (var index = 0; index < lines.length; index++) {
        if ((lines[index] + "").indexOf('-') !== -1) {
            let lowerBound = parseInt(lines[index].split('-')[0]);
            let upperBound = parseInt(lines[index].split('-')[1]);
            for (var i = lowerBound; i <= upperBound; i++) {
                values.push(i);
            }
        } else {
            values.push(parseInt(lines[index]));
        }
    }

    values = values.filter(function (value, index, self) {
        return self.indexOf(value) === index;
    });

    return values;
}

function getBearer(){
    return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({name: 'getCookie', sessionKey: btoa(baseUrl) }, function(bearer){
            resolve(bearer[`secadvisor${btoa(baseUrl)}`]);
        })
    });
}

/**
* methode die ein request vorbereitet, und liefert die Daten
* als json Datei zurück
* @param url des Server
* @param data ,die den User eingibt
* @returns response.json()
*/
async function postData(url, data = {}) {
    let bearer = await getBearer();
    return fetch(url, {
        method: 'POST',
        mode: 'cors', //no-cors lässt nur einen begrenzten Headern in dem request zu
        cache: 'no-cache', //URL auf demselben Ursprung wie das aufrufende Skript befindet
        credentials: 'same-origin',//URL auf demselben Ursprung wie das aufrufende Skript befindet
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": 'true',
            'Authorization': 'Bearer ' + bearer,
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',

        body: JSON.stringify(data) // body data-type muss mit dem headers "Content-Type" übereinstimmen
    }).then(response => response.json())
    .catch(error => {
        console.error('Error:', error);
    });
}


/**
* methode um ein Reason zu handeln,und die Daten(reason,codeline) von User
* zu speichern und am ende die postData methode aufzurufen
* @param form das ist das reason-bobup
*/
async function handleCodeReport(form, button, codeBlockIndex, realTime) {
    //test https://stackoverflow.com/questions/9572795/convert-list-to-array-in-java?

    button.classList.add('sa_btn_loading');
    var reason = {
        "soPostId": form.getAttribute('Answerid'),
        "reason": form['reason'].value,
        "rows": form['codeline'].value,
        "codeBlockIndex": codeBlockIndex,
        "type": form['type'].value,
        "realTime": realTime,
    };

    //die reason-Daten an postData methode geben
    bearer = await getBearer();
    if(bearer && Object.keys(bearer).length !== 0){
        postData(baseUrl + 'request', reason)
            .then(data => {
                button.classList.add('sa_successStatus')
            })
            .catch(error => {
                button.classList.add('sa_failureStatus') 
            });
        button.classList.remove('sa_btn_loading') 
    }
}

/**
 * Erstellt einene Kopie eines CodeBlocks. Die Klassenliste und der Inhalt wird übernommen
 * @param {HTML-pre} codeBlock 
 * @returns die Kopie des CodeBlocks als HTML-code
 */
function generateCodeBlockCopy(codeBlock) {
    let copy = document.createElement('pre');
    codeBlock.classList
    let classes = codeBlock.classList;
    if (!classes.contains('s-code-block')) {
        classes.add('s-code-block');
    }
    // Note that codeBlock.getElementsByTagName('code')[0] can be null
    let split = codeBlock.getElementsByTagName('code')[0]?.innerHTML.split('\n');
    if (!split) {
        return;
    }
    for (let index = 0; index < split.length - 1; index++) {
        let line = document.createElement('code');
        line.innerHTML = split[index];
        copy.appendChild(line);
        copy.appendChild(document.createElement('br'));
    }
    copy.classList.add(...classes);
    copy.classList.add('sa_codeBlockCopy');

    return copy;
}

/**
 * Ändert die Sichtbarkeit eines HTML-Elements
 * @param {HTML-Element} element das HTML-Element
 */
function toggelDescription(element) {
    if (element.style.display === "none") {
        element.style.display = "block";
    } else {
        element.style.display = "none";
    }
}
