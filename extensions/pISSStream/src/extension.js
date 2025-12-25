// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const WebSocket = require("ws");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.text = "🚀🚽 Loading...";
	statusBar.show();
	context.subscriptions.push(statusBar);

	statusBar.command = 'extension.openPissStation'; // Custom command

    // Register the command in the extension's context
    const disposable = vscode.commands.registerCommand('extension.openPissStation', () => {
        const url = 'https://demos.lightstreamer.com/ISSLive/';  // Replace with your desired URL
        vscode.env.openExternal(vscode.Uri.parse(url));
    });

    context.subscriptions.push(disposable);

	// Connect to WebSocket
	const WEBSOCKET_PROTOCOL = "TLCP-2.4.0.lightstreamer.com"; 
	const ws = new WebSocket("wss://push.lightstreamer.com/lightstreamer", WEBSOCKET_PROTOCOL);

	ws.on("open", () => {
		const createSessionMsg = "create_session\r\nLS_adapter_set=ISSLIVE&LS_cid=GodotpISSStream%20v1.0&LS_send_sync=false&LS_cause=api\r\n";
		ws.send(createSessionMsg);
		console.log("Session creation message sent.");
	
		const subscribeMsg = "control\r\nLS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=NODE3000005&LS_schema=TimeStamp%20Value%20Status.Class%20Status.Indicator%20Status.Color%20CalibratedData&LS_snapshot=true&LS_requested_max_frequency=unlimited&LS_ack=false\r\n";
		ws.send(subscribeMsg);
		console.log("Subscription message sent.");
	});

	ws.on('message', (data) => {
		try {
            const message = data.toString().trim(); // Trim any leading/trailing whitespace
			//console.log("Message received:", message);

			// Find the index of "U,1,1," and extract the substring starting from there
			const index = message.indexOf("U,1,1,");
			if (index !== -1) {
				const messageToProcess = message.substring(index); // Get the substring starting from "U,1,1,"
				
				const parts = messageToProcess.split(",", 4); // Split into a maximum of 4 parts
				if (parts.length >= 4) {
					const fields = parts[3].split("|");
					if (fields.length >= 2) {
						const value = parseFloat(fields[1]);
						console.debug(`Updating progress bar with value: ${value}`);
						
						// Update the status bar with the percentage value
						statusBar.text = `🚀🚽 ${value}%`;
					}
				}
			}
		} catch (error) {
			console.error("Error processing message:", error);
		}
	});
	

	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
		statusBar.text = "🚀🚽 Error!";
	});

	ws.on("close", () => {
		console.log("WebSocket connection closed.");
		statusBar.text = "🚀🚽 Disconnected";
	});

	context.subscriptions.push({
		dispose: () => {
			ws.close();
		},
	});
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
