// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios');
const http = require('http');
const express = require('express');
const url = require('url');
const opn = require('opn');
const path = require('path');
const WebSocket = require('ws');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
//! https://github.com/microsoft/vscode-extension-samples



/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const socketPort = vscode.workspace.getConfiguration('devlern').get('port', 3000);

    let server;
    let ws;
    let socket;
    let uid;

        
        
    let startAuthCommand = vscode.commands.registerCommand('devlern.startAuth', async () => {
        
        try {
            const app = express();
            const sessionId = 'session-' + Math.random().toString(36).slice(2);

            app.get('/callback', async (req, res) => {
                const token = req.query.token;
                if (token) {
                    context.workspaceState.update('sessionToken', token);
                    // Serve the custom HTML file
                    res.sendFile(path.join(__dirname, '/pageAuthSucces.html'));

                    vscode.window.showInformationMessage('Autenticazione completata con successo');
                    uid = token;
                    server.close();
                } else {
                    res.send('Errore nell\'autenticazione.');
                }
            });

            server = app.listen(3001, () => {
                console.log('Server in ascolto su http://localhost:3001');
            });

            const authUrl = 'http://localhost:3000/api/Extension?sessionId=' + sessionId;
            opn(authUrl);

        } catch (error) {
            console.error(error);

        }
    });

    context.subscriptions.push(startAuthCommand);



    vscode.commands.registerCommand('devlern.startStreaming', () => {
        // Establish websocket connection
        try {
            console.log('Trying to connect to WebSocket');
            socket = new WebSocket(`http://localhost:${socketPort}/ws`);

            socket.on('connect', () => {
                console.log('WebSocket connection opened');
                vscode.window.showInformationMessage('Connessione WebSocket aperta');
                // Invia un messaggio di esempio al server
                socket.send('message', 'Ciao dal client VS Code');
            });

            socket.on('message', (data) => {
                console.log(`Received message from WebSocket: ${data}`);
                vscode.window.showInformationMessage(`Messaggio dal server WebSocket: ${data}`);
            });

            socket.on('error', (error) => {
                console.error(`WebSocket error: ${error.message}`);
                vscode.window.showErrorMessage(`Errore WebSocket: ${error.message}`);
            });

            socket.on('disconnect', () => {
                console.log('WebSocket connection closed');
                vscode.window.showInformationMessage('Connessione WebSocket chiusa');
            });
        } catch (error) {
            console.error(`WebSocket connection error: ${error.message}`);
            vscode.window.showErrorMessage(`Errore WebSocket: ${error.message}`);
        }
    });
    vscode.commands.registerCommand('devlern.sendMessage', () => {
        if (socket) {
            socket.send('message', 'Messaggio di prova dal client VS Code');
        } else {
            vscode.window.showErrorMessage('Nessuna connessione WebSocket attiva');
        }

    });

    
}

function generateUniqueToken(sessionId) {
    return jwt.sign({ sessionId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
    activate,
    deactivate
}
