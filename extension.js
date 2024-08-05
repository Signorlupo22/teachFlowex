// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios');
const http = require('http');
const express = require('express');
const url = require('url');
const opn = require('opn');
const WebSocket = require('ws');

//! https://github.com/microsoft/vscode-extension-samples

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

const clientId = 'asdkjoiasdu28193shdjasd';
const clientSecret = 'your-client-secret';
const redirectUri = 'vscode://my-extension/callback';
const authEndpoint = 'http://127.0.0.1:3000/api/Extension';
const tokenEndpoint = 'http://127.0.0.1:3000/api/Extension';
const sessionEndpoint = 'http://127.0.0.1:3000/api/Extension';

let server;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // const codelensProvider = new CodelensProvider();

    // vscode.languages.registerCodeLensProvider("*", codelensProvider);
    // vscode.commands.registerCommand("devlern.enableCodeLens", () => {
    //     vscode.workspace.getConfiguration("devlern").update("enableCodeLens", true, true);
    // });

    // vscode.commands.registerCommand("devlern.disableCodeLens", () => {
    //     vscode.workspace.getConfiguration("devlern").update("enableCodeLens", false, true);
    // });

    // vscode.commands.registerCommand("devlern.codelensAction", (args) => {
    //     vscode.window.showInformationMessage(`CodeLens action clicked with args=${args}`);
    // });
    let server;
    let ws;

    let startAuthCommand = vscode.commands.registerCommand('devlern.startAuth', async () => {

        try {
            const app = express();
    
            app.get('/callback', async (req, res) => {
                const token = req.query.token;
                if (token) {
                    context.workspaceState.update('sessionToken', token);
                    res.send('Autenticazione completata. Puoi tornare a VS Code.');
                    vscode.window.showInformationMessage('Autenticazione completata con successo.' + token);
                    server.close();
                } else {
                    res.send('Errore nell\'autenticazione.');
                }
            });
    
            server = app.listen(3001, () => {
                console.log('Server in ascolto su http://localhost:3001');
            });
    
            const authUrl = 'http://localhost:3000/api/Extension';
            opn(authUrl);
            
        } catch (error) {
            console.error(error);
            
        }
    });

    context.subscriptions.push(startAuthCommand);



    let connectToServerCommand = vscode.commands.registerCommand('devlern.connectToServer', async () => {
        const token = context.workspaceState.get('sessionToken');
        if (token) {
            ws = new WebSocket('ws://localhost:3002');

            ws.on('open', () => {
                vscode.window.showInformationMessage('Connesso al server WebSocket');
                ws.send(JSON.stringify({ type: 'auth', token: token }));
            });

            ws.on('message', (message) => {
                vscode.window.showInformationMessage(`Messaggio ricevuto: ${message}`);
                // Gestisci il messaggio ricevuto qui
            });

            ws.on('close', () => {
                vscode.window.showWarningMessage('Connessione WebSocket chiusa');
            });

            ws.on('error', (error) => {
                console.error(error);
                vscode.window.showErrorMessage(`Errore WebSocket: ${error.message}`);
            });
        } else {
            vscode.window.showWarningMessage('Token di sessione non trovato');
        }
    });

    context.subscriptions.push(connectToServerCommand);

    let sendMessageCommand = vscode.commands.registerCommand('devlern.sendMessage', async () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('Hello from VS Code extension');
            vscode.window.showInformationMessage('Messaggio inviato al server WebSocket');
        } else {
            vscode.window.showWarningMessage('Connessione WebSocket non aperta');
        }
    });

    context.subscriptions.push(sendMessageCommand);
    
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
