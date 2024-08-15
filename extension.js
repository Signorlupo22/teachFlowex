const vscode = require("vscode");
const express = require("express");
const opn = require("opn");
const path = require("path");
const jwt = require("jsonwebtoken");
const {webSocketFun} = require("./src/webSocket.js");

//! https://github.com/microsoft/vscode-extension-samples

let ws;
const urls = "teachflow.app";
function activate(context) {
    var userInput = undefined;
    let server;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage(
            "Nessuna cartella aperta nel workspace."
        );
        return;
    }
    let startAuthCommand = vscode.commands.registerCommand(
        "Teachflow.startSession",
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
                        webSocketFun(context,userInput);
                        server.close();
                    } else {
                        res.send("Errore nell'autenticazione.");
                    }
                });

                server = app.listen(4298, () => {
                    console.log("Server in ascolto su http://localhost:4298");
                });

                const authUrl =
                    `https://${urls}/api/Extension?token=` + userInput;
                opn(authUrl);
            } catch (error) {
                console.error(error);
            }
        }
    );

    context.subscriptions.push(startAuthCommand);
}

// This method is called when your extension is deactivated
function deactivate() {
    ws.close();
}

module.exports = {
    activate,
    deactivate,
};
