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
// const url = "https://teachflow.villafavero.com/api/Extension";
const urls = "https://teachflow.app";
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
        "devlern.startSession",
        async () => {
            userInput = await vscode.window.showInputBox({
                prompt: "Insert your code here:",
                placeHolder: "xx-xxx-xxx",
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
                    `http://${urls}/api/Extension?token=` + userInput;
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
                const searchString = json.searchString; // Stringa da cercare
                const filePath = path.join(currentDir, json.file);
                const fileUri = vscode.Uri.file(filePath);

                vscode.workspace.openTextDocument(fileUri).then(
                    (document) => {
                        const text = document.getText();
                        const lines = text.split("\n");
                        let line = -1;

                        // Cerca la stringa nel documento
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes(searchString)) {
                                line = i + 1; // Inserisce subito dopo la riga trovata
                                break;
                            }
                        }

                        if (line !== -1) {
                            vscode.window
                                .showTextDocument(document)
                                .then((editor) => {
                                    const position = new vscode.Position(
                                        line,
                                        0
                                    );

                                    // Creazione della decorazione per evidenziare il testo
                                    const decorationType =
                                        vscode.window.createTextEditorDecorationType(
                                            {
                                                backgroundColor:
                                                    "rgba(0, 255, 0, 0.3)", // Verde semi-trasparente
                                            }
                                        );

                                    editor
                                        .edit((editBuilder) => {
                                            editBuilder.insert(
                                                position,
                                                `\n${json.code}`
                                            );
                                        })
                                        .then((success) => {
                                            if (success) {
                                                vscode.window.showInformationMessage(
                                                    `Codice inserito in ${json.file} dopo la stringa "${searchString}"`
                                                );

                                                const startPos = position;
                                                const endPos =
                                                    new vscode.Position(
                                                        startPos.line +
                                                            json.code.split(
                                                                "\n"
                                                            ).length -
                                                            1,
                                                        json.code
                                                            .split("\n")
                                                            .slice(-1)[0].length
                                                    );
                                                const range = new vscode.Range(
                                                    startPos,
                                                    endPos
                                                );

                                                editor.setDecorations(
                                                    decorationType,
                                                    [range]
                                                );

                                                setTimeout(() => {
                                                    editor.setDecorations(
                                                        decorationType,
                                                        []
                                                    );
                                                }, 2000);
                                            } else {
                                                vscode.window.showErrorMessage(
                                                    "Errore durante l'inserimento del codice."
                                                );
                                            }
                                        });
                                });
                        } else {
                            vscode.window.showErrorMessage(
                                `Stringa "${searchString}" non trovata nel file.`
                            );
                        }
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Errore nell'aprire il file: ${error.message}`
                        );
                    }
                );
                break;
            case "removeCode":
                const removeFilePath = path.join(currentDir, json.file);
                const removeFileUri = vscode.Uri.file(removeFilePath);

                vscode.workspace.openTextDocument(removeFileUri).then(
                    (document) => {
                        vscode.window
                            .showTextDocument(document)
                            .then((editor) => {
                                const codeToRemove = json.code.split("\n"); // Codice da rimuovere, diviso per linee
                                const text = document.getText();
                                const lines = text.split("\n");
                                let found = false;

                                const rangesToDelete = []; // Raccogliamo tutti i range da cancellare

                                codeToRemove.forEach((codeLine) => {
                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i];
                                        const index = line.indexOf(codeLine);

                                        if (index !== -1) {
                                            found = true;
                                            const startPosition =
                                                new vscode.Position(i, index);
                                            const endPosition =
                                                new vscode.Position(
                                                    i,
                                                    index + codeLine.length
                                                );
                                            const range = new vscode.Range(
                                                startPosition,
                                                endPosition
                                            );

                                            // Creazione della decorazione per evidenziare il testo da rimuovere
                                            const decorationType =
                                                vscode.window.createTextEditorDecorationType(
                                                    {
                                                        backgroundColor:
                                                            "rgba(255, 0, 0, 0.3)", // Rosso semi-trasparente
                                                    }
                                                );

                                            editor.setDecorations(
                                                decorationType,
                                                [range]
                                            );
                                            rangesToDelete.push(range); // Aggiungiamo il range alla lista
                                        }
                                    }
                                });

                                // Rimozione delle decorazioni e delle linee dopo 2 secondi
                                setTimeout(() => {
                                    if (rangesToDelete.length > 0) {
                                        editor.setDecorations(
                                            vscode.window.createTextEditorDecorationType(
                                                {}
                                            ),
                                            []
                                        ); // Rimozione decorazione

                                        editor
                                            .edit((editBuilder) => {
                                                rangesToDelete.forEach(
                                                    (range) => {
                                                        editBuilder.delete(
                                                            range
                                                        );
                                                    }
                                                );
                                            })
                                            .then((success) => {
                                                if (success) {
                                                    vscode.window.showInformationMessage(
                                                        `Codice rimosso da ${json.file}`
                                                    );
                                                } else {
                                                    vscode.window.showErrorMessage(
                                                        "Errore durante la rimozione del codice."
                                                    );
                                                }
                                            });
                                    } else {
                                        vscode.window.showErrorMessage(
                                            `Il codice specificato non è stato trovato in ${json.file}.`
                                        );
                                    }
                                }, 2000);
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
                    vscode.window.showErrorMessage(
                        `Il file ${json.file} esiste già.`
                    );
                    return;
                }

                fs.writeFileSync(createFilePath, json.content || "", "utf8");

                // Mostra un messaggio di successo
                vscode.window.showInformationMessage(
                    `File ${json.file} creato con successo.`
                );

                // Apri il file nell'editor
                const fileUri2 = vscode.Uri.file(createFilePath);
                vscode.workspace.openTextDocument(fileUri2).then(
                    (document) => {
                        vscode.window.showTextDocument(document);
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Errore nell'aprire il file: ${error.message}`
                        );
                    }
                );

                break;
            case "highlightCode":
                const highlightFilePath = path.join(currentDir, json.file);

                if (!fs.existsSync(highlightFilePath)) {
                    vscode.window.showErrorMessage(
                        `File non trovato: ${json.file}`
                    );
                    return;
                }

                const highlightFileUri = vscode.Uri.file(highlightFilePath);

                vscode.workspace.openTextDocument(highlightFileUri).then(
                    (document) => {
                        vscode.window
                            .showTextDocument(document)
                            .then((editor) => {
                                const documentText = document.getText();
                                const startIndex = documentText.indexOf(
                                    json.code
                                );

                                if (startIndex === -1) {
                                    vscode.window.showErrorMessage(
                                        `Codice non trovato nel file: ${json.code}`
                                    );
                                    return;
                                }

                                const startPosition =
                                    document.positionAt(startIndex);
                                const endPosition = document.positionAt(
                                    startIndex + json.code.length
                                );
                                const range = new vscode.Range(
                                    startPosition,
                                    endPosition
                                );

                                // Seleziona e evidenzia il testo
                                editor.selection = new vscode.Selection(
                                    startPosition,
                                    endPosition
                                );
                                editor.revealRange(
                                    range,
                                    vscode.TextEditorRevealType.InCenter
                                );

                                // Aggiungi un hover provider per visualizzare il tooltip
                                const hoverProvider =
                                    vscode.languages.registerHoverProvider(
                                        {
                                            scheme: "file",
                                            language: "javascript",
                                        },
                                        {
                                            provideHover: (
                                                document,
                                                position
                                            ) => {
                                                if (range.contains(position)) {
                                                    return new vscode.Hover(
                                                        json.tooltip
                                                    );
                                                }
                                            },
                                        }
                                    );

                                // Mostra il tooltip subito dopo aver evidenziato
                                vscode.commands.executeCommand(
                                    "editor.action.showHover"
                                );

                                // Registra il provider temporaneamente
                                const disposable =
                                    vscode.Disposable.from(hoverProvider);

                                // Rimuovi il provider dopo 10 secondi (o a piacere)
                                setTimeout(() => {
                                    disposable.dispose();
                                }, 10000);
                            });
                    },
                    (error) => {
                        vscode.window.showErrorMessage(
                            `Errore nell'aprire il file: ${error.message}`
                        );
                    }
                );
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
