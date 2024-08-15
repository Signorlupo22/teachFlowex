const WebSocket = require("ws");
const { createFile, gitClone, highlightCode, insertCode, removeCode } = require("./function.js");
const vscode = require("vscode");

let ws;
const urls = "teachflow.app";
function webSocketFun(context, userInput) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage(
            "Nessuna cartella aperta. Apri una cartella prima di utilizzare questa estensione."
        );
        return;
    }
    const currentDir = workspaceFolders[0].uri.fsPath;

    const jwt = context.workspaceState.get("jwt");
    const uid = context.workspaceState.get("uid");
    ws = new WebSocket(`wss://${urls}/ws`, {
        headers: {
            Authorization: `Bearer ${jwt}`,
            token: userInput,
            uid: uid,
            //add other headers as per your requirement
        },
    });
    ws.on("open", () => {
        console.log("WebSocket connection opened");
        vscode.window.showInformationMessage("Connessione WebSocket aperta");
    });
    ws.on("message", (data) => {
        console.log(`Received message from WebSocket: ${data}`);

        decodeResponse(data, currentDir);
    });
    ws.on("error", (error) => {
        console.error(`WebSocket error: ${error.message}`);
        vscode.window.showErrorMessage(`Errore WebSocket: ${error.message}`);
    });
    ws.on("close", () => {
        console.log("WebSocket connection closed");
        vscode.window.showInformationMessage("Connessione WebSocket chiusa");
    });
}

///all the request from the server are decoded here
/// the json object is parsed and the type of the request is checked
/// if you want to create a new type you have to add a new case in the switch
/// and create a new function in function.js
function decodeResponse(data, currentDir) {
    const json = JSON.parse(data);

    switch (json.type) {
        case "gitClone":
            gitClone(json, currentDir);
            break;
        case "insertCode":
            insertCode(json, currentDir);
            break;
        case "removeCode":
           removeCode(json, currentDir);
        case "createFile":
            createFile(json, currentDir);   
            break;
        case "highlightCode":
           highlightCode(json, currentDir);
            break;
        default:
            vscode.window.showErrorMessage("Tipo non riconosciuto.");
            break;
    }
}


module.exports = {
    webSocketFun,
    ws,
};