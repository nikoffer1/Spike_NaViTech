// script.js
// UUIDs - FINAL VERSION - CORRECTED SERVICE, DEBUG LOGS, FORCED TRIGGER - EXPECTED TO WORK!
const PYBRICKS_COMMAND_EVENT_CHAR_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef";
const PYBRICKS_COMMAND_EVENT_SERVICE_UUID = "c5f50001-8280-46da-89f4-6d8051e4aeef"; // CORRECTED SERVICE UUID

let hubReadyReceived = false;
let sensorDataDisplayed = false;  // Flag: tracks if sensor data is currently displayed
let bluetoothDevice = null;
let commandEventCharacteristic = null;
let dataStreamActive = false;
let expectingSensorData = false;
let ignoreFirstNotification = false; // ADD THIS FLAG

// UI Elements
const connectButton = document.getElementById("connectButton");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const disconnectButton = document.getElementById("disconnectButton");
const prunusButton = document.getElementById("prunusButton");
const statusDiv = document.getElementById("status");
const sensorDataDiv = document.getElementById("sensorData");

// --- EVENT LISTENERS ---
connectButton.addEventListener('click', function() {
  if (isWebBluetoothEnabled()) { connectGATT(); }
});

startButton.addEventListener('click', function() {
  if (isWebBluetoothEnabled()) { startDataStream(); }
});

stopButton.addEventListener('click', function() {
  if (isWebBluetoothEnabled()) { stopDataStream(); }
});

disconnectButton.addEventListener('click', function() {
  if (isWebBluetoothEnabled()) { disconnectGATT(); }
});

prunusButton.addEventListener('click', function() {
  if (isWebBluetoothEnabled() && dataStreamActive && hubReadyReceived) {
      sendPrunusCommand();
  } else {
      statusDiv.textContent += "\nStatus: Data stream not active. Start data stream first.";
  }
});

// --- FUNCTION DEFINITIONS ---
function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API is not available in this browser!');
    statusDiv.textContent = 'Error: Web Bluetooth API is not available in this browser!';
    return false;
  }
  return true;
}

function connectGATT() {
  statusDiv.textContent = "Status: Scanning for devices...";
  sensorDataDiv.textContent = "FIRST RUN THE PROGRAM ON HUB";
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;

  const options = {
    optionalServices: [PYBRICKS_COMMAND_EVENT_SERVICE_UUID],
    filters: [{ name: "NaViTech" }]
  };

  console.log('Requesting Bluetooth Device...');
  navigator.bluetooth.requestDevice(options)
    .then(device => {
      bluetoothDevice = device;
      statusDiv.textContent = `Status: Device selected: ${bluetoothDevice.name}`;
      console.log('Device selected:', bluetoothDevice);
      return bluetoothDevice.gatt.connect();
    })
    .then(server => {
      statusDiv.textContent += "\nStatus: Connected to GATT Server.";
      console.log('GATT Server connected:', server);
      return server.getPrimaryService(PYBRICKS_COMMAND_EVENT_SERVICE_UUID);
    })
    .then(service => {
      statusDiv.textContent += "\nStatus: Getting Command/Event Characteristic from Service...";
      console.log('Getting Command/Event Characteristic from Service:', service);
      return service.getCharacteristic(PYBRICKS_COMMAND_EVENT_CHAR_UUID);
    })
    .then(characteristic => {
      commandEventCharacteristic = characteristic;
      statusDiv.textContent = "\nStatus: Command/Event Characteristic found.";
      console.log('Command/Event Characteristic found:', commandEventCharacteristic);
      startButton.disabled = false;
      stopButton.disabled = true;
      disconnectButton.disabled = false;
      prunusButton.disabled = true;
      statusDiv.textContent = "\nStatus: Ready to start data stream (press 'Start Data Stream').";
    })
    .catch(error => {
      console.error('Connection error:', error);
      statusDiv.textContent += "\nError: Connection failed: " + (error.message || error);
      startButton.disabled = true;
      stopButton.disabled = true;
      disconnectButton.disabled = true;
      prunusButton.disabled = true;
    });
}

// Global notification handler (used for "rdy" messages)
function handleNotifications(event) {
  const value = event.target.value;
  const decodedStringUTF8 = new TextDecoder('utf-8').decode(value);
  let cleanedData = decodedStringUTF8.replace(/\0/g, '').trim();

  // Remove first character if it isn't alphanumeric
  if (cleanedData.length > 0 && !/[a-zA-Z0-9]/.test(cleanedData.charAt(0))) {
    cleanedData = cleanedData.substring(1);
  }

  setTimeout(function() {
    // Process "rdy" only if not expecting sensor data and no sensor data is displayed.
    if (cleanedData === "rdy" && !expectingSensorData && !sensorDataDisplayed) {
      statusDiv.textContent += "\nStatus: Hub is ready and waiting for command.";
      sensorDataDiv.textContent = "Hub Ready.";
      hubReadyReceived = true;
      prunusButton.disabled = false;
      return;
    }
    console.log("Ignoring spurious notification:", cleanedData);
  }, 0);
}

function startDataStream() {
  statusDiv.textContent += "\nStatus: Starting data stream...";
  startButton.disabled = true;
  stopButton.disabled = false;
  prunusButton.disabled = true;
  sensorDataDiv.textContent = "Data stream started. Waiting for Hub to be ready...";
  dataStreamActive = true;
  expectingSensorData = false;
  sensorDataDisplayed = false; // Reset stored sensor data flag
  ignoreFirstNotification = true; // SET FLAG TO IGNORE FIRST NOTIFICATION

  console.log("startDataStream FUNCTION CALLED");
  console.log("Starting notifications on Command/Event characteristic...", commandEventCharacteristic);

  if (!commandEventCharacteristic) {
    console.error("Characteristic is not available. Cannot start notifications.");
    statusDiv.textContent += "\nError: Characteristic unavailable.";
    return;
  }

  // Start notifications for "rdy" messages.
  commandEventCharacteristic.startNotifications()
    .then(() => {
      statusDiv.textContent = "\nStatus: Data stream started (Command/Event Char).";
      console.log('Data stream started successfully (Command/Event Char).');
      statusDiv.textContent += "\nStatus: Waiting for 'rdy' message from hub...";
      // Remove any previous listener to avoid duplicates.
      commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
      commandEventCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      console.log('Event listener added for characteristicvaluechanged.');
    })
    .catch(error => {
      console.error('Error starting data stream:', error);
      statusDiv.textContent += "\nError starting data stream: " + (error.message || error);
      startButton.disabled = false;
      stopButton.disabled = true;
      prunusButton.disabled = true;
      dataStreamActive = false;
      expectingSensorData = false;
      ignoreFirstNotification = false;
    });
}

function stopDataStream() {
  statusDiv.textContent += "\nStatus: Stopping data stream.";
  startButton.disabled = false;
  stopButton.disabled = true;
  prunusButton.disabled = true;
  sensorDataDiv.textContent = "Data stream stopped. Press 'Start Data Stream' to begin.";
  dataStreamActive = false;
  expectingSensorData = false;
  ignoreFirstNotification = false;

  if (!commandEventCharacteristic) {
    console.warn("Characteristic is not available. Data stream may already be stopped.");
    return;
  }

  // Stop notifications and remove the event listener.
  commandEventCharacteristic.stopNotifications()
    .then(() => {
      commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
      statusDiv.textContent += "\nStatus: Data stream stopped (Command/Event Char).";
      console.log('Data stream stopped (Command/Event Char).');
    })
    .catch(error => {
      console.error('Error stopping data stream:', error);
      statusDiv.textContent += "\nError stopping data stream: " + (error.message || error);
      startButton.disabled = false;
      stopButton.disabled = true;
      prunusButton.disabled = true;
      dataStreamActive = false;
      expectingSensorData = false;
      ignoreFirstNotification = false;
    });
}

function disconnectGATT() {
  statusDiv.textContent += "\nStatus: Disconnecting from hub...";
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;
  dataStreamActive = false;
  expectingSensorData = false;
  ignoreFirstNotification = false;
  sensorDataDiv.textContent = "Data stream stopped. FIRST RUN THE PROGRAM ON HUB";

  if (commandEventCharacteristic) {
    // Remove the notification event listener, if present.
    commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
  }

  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
    statusDiv.textContent += "\nStatus: Disconnected from hub.";
    console.log('Disconnected from hub.');
  } else {
    statusDiv.textContent += "\nStatus: No device connected.";
    console.log('No device connected.');
  }
  connectButton.disabled = false;
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;
  bluetoothDevice = null;
  commandEventCharacteristic = null;
}

//This is an example key, you will need to add your key here
const API_KEY = 'MY_API_KEY;
//Function for the gemini
async function analyzeSpectroscopicData(sensorData) {
    statusDiv.textContent += "\nStatus: Getting analysis from Gemini API...";
    sensorDataDiv.textContent = "Getting analysis from Gemini API...";
    const genAI = new google.generativeai.GenerativeModel({ model: 'gemini-1.5-pro-latest', apiKey: API_KEY});

    const prompt = `Analyze the following spectroscopic data and provide a detailed interpretation.  Relate these values to potential material composition or environmental conditions.  Be thorough and scientific. Respond in a format readable to the end user. Assume that the readings are from a handheld sensor device, and the user is attempting to ascertain basic chemical makeups.
        Hue: ${sensorData.hue}
        Saturation: ${sensorData.saturation}
        Color Value: ${sensorData.colorValue}
        Reflection: ${sensorData.reflection}
        Ambient Light: ${sensorData.ambient}
    `;

    try {
        const result = await genAI.generateContent(prompt);
        const responseText = result.response.text();
        sensorDataDiv.textContent = "Spectroscopic Analysis:\n" + responseText;
        console.log(responseText);
    } catch (error) {
        console.error("Gemini API Error:", error);
        sensorDataDiv.textContent = "Error during spectroscopic analysis: " + error.message;
    }
}

function sendPrunusCommand() {
    let sensorBuffer = '';
    
    function handleSensorData(event) {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer);
    
    // Handle potential split packets
    let decoded;
    try {
        // Check for "write stdout" event type (0x01)
        if (data[0] === 0x01) {
            decoded = new TextDecoder('utf-8').decode(data.slice(1));
        } else {
            decoded = new TextDecoder('utf-8').decode(data);
        }
    } catch (error) {
        console.error('Decoding error:', error);
        return;
    }

    // Add to buffer and process complete lines
    sensorBuffer += decoded;
    
    // Process complete messages
    const messages = sensorBuffer.split('\n');
    if (messages.length > 1) {
        // Keep incomplete message in buffer
        sensorBuffer = messages.pop(); 
        
        messages.forEach(message => {
            message = message.trim();
            if (message.startsWith('NaVi')) {
                const dataStr = message.substring(4).trim();
                const parts = dataStr.split(',');
                
                if (parts.length === 5) {
                    const [hue, saturation, colorValue, reflection, ambient] = parts;
                    const naviData = {hue, saturation, colorValue, reflection, ambient};
                    analyzeSpectroscopicData(naviData);

                } else {
                    sensorDataDiv.textContent = `Invalid data format: ${message}`;
                }
            }
        });
    }
}
    // Clear previous data
    sensorDataDiv.textContent = "Waiting for sensor data...";
    
    const tempHandler = (event) => {
        const value = event.target.value;
        const data = new Uint8Array(value.buffer);
        
        // Handle message type byte (0x01 for stdout)
        if (data[0] === 0x01) {
            const decoded = new TextDecoder('utf-8').decode(data.slice(1));
            sensorBuffer += decoded;
            
            // Check for complete messages
            if (sensorBuffer.includes('\n')) {
                const messages = sensorBuffer.split('\n');
                messages.forEach(msg => {
                    if (msg.startsWith('NaVi')) {
                        const values = msg.substring(4).split(',');
                        if (values.length === 5) {
                            sensorDataDiv.textContent = 
                                `Hue: ${values[0]}\nSaturation: ${values[1]}\n` +
                                `Value: ${values[2]}\nReflection: ${values[3]}\n` +
                                `Ambient: ${values[4]}`;
                        }
                    }
                });
                sensorBuffer = '';
            }
        }
    };

    // Switch to temporary handler
    commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
    commandEventCharacteristic.addEventListener('characteristicvaluechanged', tempHandler);

    // Send prunus command with proper encoding
    const encoder = new TextEncoder();
    const command = new Uint8Array([0x06, ...encoder.encode('prunus')]);
    
    commandEventCharacteristic.writeValue(command)
        .then(() => {
            statusDiv.textContent += "\nStatus: 'prunus' command sent successfully";
            setTimeout(() => {
                // Restore original handler after 2 seconds
                commandEventCharacteristic.removeEventListener('characteristicvaluechanged', tempHandler);
                commandEventCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
            }, 2000);
        })
        .catch(error => {
            console.error('Send error:', error);
            statusDiv.textContent += "\nError sending command: " + error.message;
        });
}

//INITIAL UI SETUP
sensorDataDiv.textContent = "FIRST RUN THE PROGRAM ON HUB";
startButton.disabled = true;
stopButton.disabled = true;
prunusButton.disabled = true;
disconnectButton.disabled = true;
