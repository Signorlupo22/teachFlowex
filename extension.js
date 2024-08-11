// The module 'vscode' contains the VS Code extensibility API
const exec = require("child_process").exec;

// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const axios = require("axios");
const http = require("http");
const express = require("express");
const url = require("url");
const opn = require("opn");
const path = require("path");
const WebSocket = require("ws");
const io = require("socket.io-client");
const jwt = require("jsonwebtoken");
const fs = require("fs");
//! https://github.com/microsoft/vscode-extension-samples

/**
 * @param {vscode.ExtensionContext} context
 */
let ws;
function activate(context) {
    const socketPort = vscode.workspace
        .getConfiguration("devlern")
        .get("port", 3000);
    var userInput = undefined;
    let server;
    let socket;
    let uid;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage(
            "Nessuna cartella aperta nel workspace."
        );
        return;
    }
    const currentDir = workspaceFolders[0].uri.fsPath;

    let startAuthCommand = vscode.commands.registerCommand(
        "devlern.startAuth",
        async () => {
            userInput = await vscode.window.showInputBox({
                prompt: "Inserisci il tuo Codice:",
                placeHolder: "Scrivi qualcosa qui...",
            });

            if (userInput == undefined) {
                return;
            }
            try {
                const app = express();

                app.get("/callback", async (req, res) => {
                    if (!req.query.jwt) {
                        res.send("Errore nell'autenticazione.");
                        return;
                    }
                    const jwtToken = req.query.jwt;
                    const decoded = jwt
                        ? jwt.decode(jwtToken.toString())
                        : null;
                    if (decoded) {
                        var json = JSON.parse(JSON.stringify(decoded));
                        context.workspaceState.update("jwt", jwtToken);
                        context.workspaceState.update("uid", json.userId);
                        // Serve the custom HTML file
                        res.sendFile(
                            path.join(__dirname, "/pageAuthSucces.html")
                        );

                        vscode.window.showInformationMessage(
                            "Autenticazione completata con successo"
                        );
                        vscode.window.showInformationMessage(
                            "Trying to connect to WebSocket"
                        );
                        connectToWebSocket();
                        server.close();
                    } else {
                        res.send("Errore nell'autenticazione.");
                    }
                });

                server = app.listen(3001, () => {
                    console.log("Server in ascolto su http://localhost:3001");
                });

                const authUrl =
                    "http://localhost:3000/api/Extension?token=" + userInput;
                opn(authUrl);
            } catch (error) {
                console.error(error);
            }
        }
    );

    context.subscriptions.push(startAuthCommand);

    function connectToWebSocket() {
        const jwt = context.workspaceState.get("jwt");
        const uid = context.workspaceState.get("uid");
        ws = new WebSocket(`ws://localhost:${socketPort}/ws`, {
            headers: {
                Authorization: `Bearer ${jwt}`,
                token: userInput,
                uid: uid,
                //add other headers as per your requirement
            },
        });
        ws.on("open", () => {
            console.log("WebSocket connection opened");
            vscode.window.showInformationMessage(
                "Connessione WebSocket aperta"
            );
        });
        ws.on("message", (data) => {
            console.log(`Received message from WebSocket: ${data}`);

            decodeResponse(data);
        });
        ws.on("error", (error) => {
            console.error(`WebSocket error: ${error.message}`);
            vscode.window.showErrorMessage(
                `Errore WebSocket: ${error.message}`
            );
        });
        ws.on("close", () => {
            console.log("WebSocket connection closed");
            vscode.window.showInformationMessage(
                "Connessione WebSocket chiusa"
            );
        });
    }
    function decodeResponse(data) {
        const json = JSON.parse(data);

        switch (json.type) {
            case "gitClone":
                exec(
                    `git clone ${json.url} .`,
                    { cwd: currentDir },
                    (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(
                                `Errore: ${error.message}`
                            );
                            return;
                        }
                        if (stderr) {
                            vscode.window.showErrorMessage(`stderr: ${stderr}`);
                            return;
                        }
                        vscode.window.showInformationMessage(
                            `stdout: ${stdout}`
                        );
                    }
                );
                break;
            case "insertCode":
                const [line, column] = json.lineAndColumn
                    .split(":")
                    .map(Number);
                const filePath = path.join(currentDir, json.file);
                const fileUri = vscode.Uri.file(filePath);
                vscode.workspace.openTextDocument(fileUri).then(
                    (document) => {
                        vscode.window
                            .showTextDocument(document)
                            .then((editor) => {
                                const position = new vscode.Position(
                                    line - 1,
                                    column - 1
                                ); // Le linee e colonne iniziano da 0
                                editor
                                    .edit((editBuilder) => {
                                        editBuilder.insert(position, json.code);
                                    })
                                    .then((success) => {
                                        if (success) {
                                            vscode.window.showInformationMessage(
                                                `Codice inserito in ${json.file} alla posizione ${json.lineAndColumn}`
                                            );
                                        } else {
                                            vscode.window.showErrorMessage(
                                                "Errore durante l'inserimento del codice."
                                            );
                                        }
                                    });
                            });
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Errore nell'aprire il file: ${error.message}`
                        );
                    }
                );
                break;
            case "removeLines":
                const removeFilePath = path.join(currentDir, json.file);

                const removeFileUri = vscode.Uri.file(removeFilePath);

                vscode.workspace.openTextDocument(removeFileUri).then(
                    (document) => {
                        vscode.window
                            .showTextDocument(document)
                            .then((editor) => {
                                const startLine = json.startLine - 1; // Le linee inizia da 0
                                const endLine = json.endLine
                                    ? json.endLine - 1
                                    : startLine; // Se endLine non è fornito, rimuove una sola linea

                                const startPosition = new vscode.Position(
                                    startLine,
                                    0
                                );
                                const endPosition = new vscode.Position(
                                    endLine,
                                    document.lineAt(endLine).text.length
                                );

                                editor
                                    .edit((editBuilder) => {
                                        editBuilder.delete(
                                            new vscode.Range(
                                                startPosition,
                                                endPosition
                                            )
                                        );
                                    })
                                    .then((success) => {
                                        if (success) {
                                            vscode.window.showInformationMessage(
                                                `Linee ${json.startLine} - ${
                                                    json.endLine ||
                                                    json.startLine
                                                } rimosse in ${json.file}`
                                            );
                                        } else {
                                            vscode.window.showErrorMessage(
                                                "Errore durante la rimozione delle linee."
                                            );
                                        }
                                    });
                            });
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Errore nell'aprire il file: ${error.message}`
                        );
                    }
                );
                break;
            case "createFile":
                const createFilePath = path.join(currentDir, json.file);
                const dirPath = path.dirname(createFilePath);
    
                // Crea le directory se non esistono
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
    
                if (fs.existsSync(createFilePath)) {
                    vscode.window.showErrorMessage(`Il file ${json.file} esiste già.`);
                    return;
                }
    
                fs.writeFileSync(createFilePath, json.content || '', 'utf8');
                vscode.window.showInformationMessage(`File ${json.file} creato con successo.`);
                break;    
            default:
                vscode.window.showErrorMessage("Tipo non riconosciuto.");
                break;
        }
    }
}

// This method is called when your extension is deactivated
function deactivate() {
    console.log("Deactivated");
    ws.close();
}

module.exports = {
    activate,
    deactivate,
};
