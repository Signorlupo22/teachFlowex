// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios');
const http = require('http');
const url = require('url');
const opn = require('opn');

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
	let disposable = vscode.commands.registerCommand('devlern.connectToBackend', async () => {
        // Step 1: Open the browser for OAuth2 authentication
        const authUrl = `${authEndpoint}`;
        const port = 3001;
        opn(authUrl);

        // Step 2: Start a local server to handle the OAuth2 callback
        server = http.createServer(async (req, res) => {
            const reqUrl = url.parse(req.url, true);
            const token = reqUrl.query['token'];
            console.log('Token ottenuto:', token);
            if (token) {
                // Close the server after getting the token
                server.close();

                try {
                    console.log('Token ottenuto:', token);

                    // Step 2: Use the token to access protected resources
                    const dataResponse = await axios.get(sessionEndpoint, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    console.log('Dati ottenuti:', dataResponse.data);
                    vscode.window.showInformationMessage('Connessione al backend riuscita!');
                } catch (error) {
                    console.error('Errore durante la connessione al backend:', error);
                    vscode.window.showErrorMessage('Errore durante la connessione al backend');
                }

            res.end();
        }});

        server.listen(port, () => {
            const callbackUrl = `http://localhost:${port}/connectToBackend`;

            // Step 2: Open the browser for Supabase authentication
            const authEndpoint = 'https://127.0.0.1/connectToBackend';
            vscode.env.openExternal(vscode.Uri.parse(authEndpoint));
        });
    });

    context.subscriptions.push(disposable);


}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
