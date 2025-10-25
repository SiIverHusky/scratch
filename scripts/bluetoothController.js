// Bluetooth Controller for Santa-Bot Connection
class BluetoothController {
    constructor() {
        this.device = null;
        this.characteristic = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.chunkedMessages = new Map();
        this.availableTools = [];
        this.autoScrollLog = true;
        this.lastConnectionTime = null;
        this.sessionData = null;
        this.autoReconnectAttempted = false;
        this.initializationRetries = 0;
        this.maxInitializationRetries = 10;
        
        // Load device configuration
        this.config = window.BluetoothDeviceConfig;
        if (!this.config) {
            console.error('❌ BluetoothDeviceConfig not loaded! Make sure bluetoothDeviceConfig.js is included before bluetoothController.js');
        }
        
        this.init();
    }

    init() {
        this.loadSessionData();
        this.setupEventListeners();
        this.updateButtonState();
        this.updateStatus('disconnected');
        
        // Initialize execution UI state (robust for cloud hosting)
        this.updateExecutionUI();
        
        // Attempt auto-reconnection after a short delay to allow other components to initialize
        setTimeout(() => {
            this.attemptAutoReconnect();
        }, 2000);
        
        // Start connection monitoring
        this.startConnectionMonitoring();
    }

    startConnectionMonitoring() {
        // Check connection status every 30 seconds
        setInterval(() => {
            if (this.isConnected && this.device && !this.device.gatt.connected) {
                this.log('📡 Connection lost detected by monitoring', 'warning');
                this.handleUnexpectedDisconnect();
            }
        }, 30000);
    }

    setupEventListeners() {
        // Bluetooth button structure
        const bluetoothContainer = document.getElementById('bluetoothButton');
        const mainButton = bluetoothContainer?.querySelector('.bt-main-button');
        const statusText = bluetoothContainer?.querySelector('.bt-status-badge');
        const debugIcon = bluetoothContainer?.querySelector('.bt-debug-button');

        // Main button with dual functionality like the save dropdown
        if (mainButton) {
            mainButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Get button bounds and click position
                const buttonRect = mainButton.getBoundingClientRect();
                const clickX = e.clientX;
                const buttonCenterX = buttonRect.left + buttonRect.width * 0.75; // Right 25% is debug area
                
                // If click is in the right 25% of the button, open debug modal
                if (clickX >= buttonCenterX) {
                    this.openDebugModal();
                } else {
                    // If click is in the left 75% of the button, perform connect/disconnect
                    if (this.isConnected) {
                        this.disconnect();
                    } else {
                        this.connect();
                    }
                }
            });
        }

        // Status text - still acts as connect/disconnect button for backward compatibility
        if (statusText) {
            statusText.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isConnected) {
                    this.disconnect();
                } else {
                    this.connect();
                }
            });
        }

        // Debug icon - keep existing functionality
        if (debugIcon) {
            debugIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDebugModal();
            });
        }

        // Modal buttons
        const clearLogBtn = document.getElementById('btClearLogBtn');
        const autoScrollCheck = document.getElementById('btAutoScrollLog');
        const reloadToolsBtn = document.getElementById('btReloadToolsBtn');

        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => this.clearLog());
        }

        if (autoScrollCheck) {
            autoScrollCheck.addEventListener('change', (e) => {
                this.autoScrollLog = e.target.checked;
            });
        }

        if (reloadToolsBtn) {
            reloadToolsBtn.addEventListener('click', () => this.manualReloadTools());
        }
    }

    // Session Data Management
    loadSessionData() {
        try {
            const savedData = localStorage.getItem('bluetoothSession');
            if (savedData) {
                this.sessionData = JSON.parse(savedData);
                const now = Date.now();
                const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                
                // Check if session data is within 7 days
                if (this.sessionData.timestamp && (now - this.sessionData.timestamp) < sevenDays) {
                    this.log('📂 Loaded previous Bluetooth session data', 'info');
                    this.availableTools = this.sessionData.tools || [];
                    this.updateToolsList();
                    
                    // Load tools into cmd dropdowns immediately
                    this.loadToolsIntoDropdowns();
                } else {
                    this.log('📂 Previous session data expired (older than 7 days)', 'info');
                    this.clearSessionData();
                }
            }
        } catch (error) {
            this.log(`❌ Failed to load session data: ${error.message}`, 'error');
            this.clearSessionData();
        }
    }

    saveSessionData() {
        try {
            this.sessionData = {
                timestamp: Date.now(),
                lastConnectionTime: this.lastConnectionTime,
                tools: this.availableTools,
                deviceName: this.device ? this.device.name : null,
                deviceId: this.device ? this.device.id : null,
                deviceType: this.getDeviceType()
            };
            
            localStorage.setItem('bluetoothSession', JSON.stringify(this.sessionData));
            this.log('💾 Saved Bluetooth session data', 'info');
        } catch (error) {
            this.log(`❌ Failed to save session data: ${error.message}`, 'error');
        }
    }

    getDeviceType() {
        if (!this.device || !this.device.name) return 'unknown';
        
        if (this.config) {
            return this.config.getDeviceType(this.device.name);
        }
        
        // Fallback logic if config not available
        return 'unknown';
    }

    clearSessionData() {
        this.sessionData = null;
        localStorage.removeItem('bluetoothSession');
    }

    async attemptAutoReconnect() {
        if (this.autoReconnectAttempted || this.isConnected || this.isConnecting) {
            return;
        }

        this.autoReconnectAttempted = true;

        if (!this.sessionData || !this.sessionData.lastConnectionTime) {
            this.log('📶 No previous connection to restore', 'info');
            return;
        }

        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        
        // Only offer auto-reconnect if last connection was within an hour
        if ((now - this.sessionData.lastConnectionTime) > oneHour) {
            this.log('📶 Previous connection too old for auto-reconnect', 'info');
            return;
        }

        this.log('📶 Previous connection found - ready to reconnect when you click Bluetooth button', 'info');
        
        // Try experimental getDevices API first (if available)
        const silentReconnectSucceeded = await this.tryReconnectWithGetDevices();
        
        // Show a clickable toast for reconnection if silent reconnection didn't work
        if (!silentReconnectSucceeded && !this.isConnected && window.toast) {
            const reconnectToast = window.toast.info('📱 Click here to reconnect to Santa-Bot', { 
                duration: 10000, // Longer duration for user convenience
                persistent: true // Keep it visible until clicked
            });
            
            // Make the toast clickable for reconnection with special styling
            if (reconnectToast) {
                reconnectToast.classList.add('clickable-reconnect');
                reconnectToast.addEventListener('click', () => {
                    this.log('🔄 Reconnecting via toast click...', 'info');
                    window.toast.hide(reconnectToast); // Hide the toast immediately
                    this.connect(true); // Connect with auto-reconnect flag
                });
                
                // Add a subtle animation hint
                reconnectToast.title = 'Click to reconnect to Santa-Bot';
            }
        }
        
        // Update button text to indicate reconnection is available (only if not connected)
        const bleBtn = document.getElementById('bleBtn');
        if (bleBtn && !this.isConnected) {
            bleBtn.textContent = 'Reconnect';
            bleBtn.style.backgroundColor = 'var(--save-primary)';
        }
    }

    async tryReconnectWithGetDevices() {
        // Try experimental getDevices API for silent reconnection
        try {
            if (navigator.bluetooth && navigator.bluetooth.getDevices) {
                this.log('🔍 Trying experimental getDevices API for silent reconnection...', 'info');
                const devices = await navigator.bluetooth.getDevices();
                
                for (const device of devices) {
                    // Check if this device is one of our supported devices
                    if (this.config && this.config.isSupported(device.name)) {
                        this.log(`📱 Found previously paired ${device.name}, attempting silent reconnection...`, 'info');
                        
                        try {
                            this.device = device;
                            
                            // Set up disconnect listener early
                            this.device.addEventListener('gattserverdisconnected', () => {
                                this.log('🔌 Device disconnected unexpectedly', 'warning');
                                this.handleUnexpectedDisconnect();
                            });
                            
                            this.log(`📡 Connecting to ${device.name} GATT server...`, 'info');
                            const server = await device.gatt.connect();
                            
                            this.log('🔍 Getting Robot Control service...', 'info');
                            const service = await server.getPrimaryService(this.config.serviceUUID);
                            
                            this.log('🔍 Getting Command & Response characteristic...', 'info');
                            this.characteristic = await service.getCharacteristic(this.config.characteristicUUID);
                            
                            // Set up notification listener
                            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                                this.handleNotification(event);
                            });
                            
                            await this.characteristic.startNotifications();
                            this.log('� Started listening for notifications', 'info');
                            
                            this.isConnected = true;
                            this.isConnecting = false;
                            this.lastConnectionTime = Date.now();
                            this.updateButtonState();
                            this.updateStatus('connected');
                            this.log(`✅ Silently reconnected to ${device.name}!`, 'success');
                            
                            // Update execution UI
                            this.updateExecutionUI();
                            
                            // Save session data
                            this.saveSessionData();
                            
                            // Load cached tools if available
                            if (this.availableTools.length > 0) {
                                this.loadToolsIntoDropdowns();
                            }
                            
                            // Request fresh tools
                            setTimeout(() => {
                                this.requestTools();
                            }, 1000);
                            
                            return true; // Success!
                            
                        } catch (reconnectError) {
                            this.log(`❌ Silent reconnection to ${device.name} failed: ${reconnectError.message}`, 'error');
                            this.device = null;
                            this.characteristic = null;
                            // Continue trying other devices
                        }
                    }
                }
                this.log('📱 No previously paired supported devices found in getDevices', 'info');
            }
        } catch (error) {
            this.log(`🔍 getDevices API failed or not supported: ${error.message}`, 'info');
        }
        
        return false; // Indicate silent reconnection failed or not possible
    }

    loadToolsIntoDropdowns() {
        // Wait a bit longer to ensure Blockly and custom blocks are fully initialized
        setTimeout(() => {
            if (this.availableTools.length > 0 && window.updateSantaCommandDropdowns) {
                this.log(`🔧 Loading ${this.availableTools.length} tools into command dropdowns`, 'info');
                window.updateSantaCommandDropdowns(this.availableTools);
            } else if (this.availableTools.length > 0) {
                this.log(`⏳ Waiting for command dropdown system to initialize...`, 'info');
                // Retry after another delay
                setTimeout(() => {
                    if (window.updateSantaCommandDropdowns) {
                        this.log(`🔧 Loading ${this.availableTools.length} tools into command dropdowns (retry)`, 'info');
                        window.updateSantaCommandDropdowns(this.availableTools);
                    }
                }, 2000);
            }
        }, 1000);
    }

    openDebugModal() {
        if (window.modalController) {
            window.modalController.openModal('bluetoothModal');
        } else {
            // Fallback direct modal control
            const modal = document.getElementById('bluetoothModal');
            if (modal) {
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        }
    }

    updateButtonState() {
        const bluetoothContainer = document.getElementById('bluetoothButton');
        const mainButton = bluetoothContainer?.querySelector('.bt-main-button');
        const statusText = bluetoothContainer?.querySelector('.bt-status-badge');
        const debugIcon = bluetoothContainer?.querySelector('.bt-debug-button');
        
        if (!statusText || !mainButton) return;

        // Don't update if already in warning state (let it persist until reset)
        if (statusText.classList.contains('bt-status-warning')) {
            return;
        }

        // Remove all state classes from status text
        statusText.classList.remove('bt-status-connecting', 'bt-status-connected', 'bt-status-disconnected');
        
        if (this.isConnecting) {
            statusText.classList.add('bt-status-connecting');
            statusText.textContent = 'Connecting...';
        } else if (this.isConnected) {
            statusText.classList.add('bt-status-connected');
            statusText.textContent = 'Connected'; /* Changed to show "Connected" */
            this.setupConnectedHover(mainButton, statusText); /* Add hover behavior to main button */
        } else {
            statusText.classList.add('bt-status-disconnected');
            statusText.textContent = 'Connect';
            this.removeConnectedHover(mainButton, statusText); /* Remove hover when disconnected */
        }

        // Update debug icon visibility based on connection state
        if (debugIcon) {
            if (this.isConnected) {
                debugIcon.classList.add('visible');
            } else {
                debugIcon.classList.remove('visible');
            }
        }

        // Update reload tools button state
        this.updateReloadToolsButton();
    }

    /* Add hover behavior methods */
    setupConnectedHover(mainButton, statusText) {
        // Remove any existing listeners first
        this.removeConnectedHover(mainButton, statusText);
        
        const onMouseEnter = () => {
            if (statusText.classList.contains('bt-status-connected')) {
                statusText.textContent = 'Disconnect';
            }
        };
        
        const onMouseLeave = () => {
            if (statusText.classList.contains('bt-status-connected')) {
                statusText.textContent = 'Connected';
            }
        };
        
        mainButton.addEventListener('mouseenter', onMouseEnter);
        mainButton.addEventListener('mouseleave', onMouseLeave);
        
        // Store references for cleanup
        mainButton._hoverEnter = onMouseEnter;
        mainButton._hoverLeave = onMouseLeave;
    }

    removeConnectedHover(mainButton, statusText) {
        if (mainButton._hoverEnter) {
            mainButton.removeEventListener('mouseenter', mainButton._hoverEnter);
            mainButton.removeEventListener('mouseleave', mainButton._hoverLeave);
            delete mainButton._hoverEnter;
            delete mainButton._hoverLeave;
        }
    }

    // Method to clear warning state
    clearWarningState() {
        const bluetoothContainer = document.getElementById('bluetoothButton');
        const statusText = bluetoothContainer?.querySelector('.bt-status-badge');
        
        if (statusText) {
            statusText.classList.remove('bt-status-warning');
            this.updateButtonState();
        }
    }

    updateStatus(status) {
        const statusEl = document.getElementById('btStatus');
        if (!statusEl) return;

        statusEl.className = `status ${status}`;
        
        switch (status) {
            case 'connected':
                statusEl.textContent = 'Connected to Santa-Bot';
                break;
            case 'connecting':
                statusEl.textContent = 'Connecting...';
                break;
            case 'disconnected':
            default:
                statusEl.textContent = 'Disconnected';
                break;
        }
    }

    updateReloadToolsButton() {
        const reloadToolsBtn = document.getElementById('btReloadToolsBtn');
        if (!reloadToolsBtn) return;

        if (this.isConnected) {
            reloadToolsBtn.disabled = false;
            reloadToolsBtn.textContent = '🔄 Reload MCP Tools';
            reloadToolsBtn.style.opacity = '1';
            reloadToolsBtn.style.cursor = 'pointer';
        } else {
            reloadToolsBtn.disabled = true;
            reloadToolsBtn.textContent = '🔄 Reload MCP Tools (Not Connected)';
            reloadToolsBtn.style.opacity = '0.5';
            reloadToolsBtn.style.cursor = 'not-allowed';
        }
    }

    // Robust method to update execution UI with retry logic for cloud hosting
    updateExecutionUI() {
        if (window.updateExecutionUI) {
            try {
                window.updateExecutionUI();
                return true;
            } catch (error) {
                console.warn('⚠️ Error calling updateExecutionUI:', error);
            }
        }
        
        // If not available immediately, retry with exponential backoff
        this.scheduleExecutionUIUpdate();
        return false;
    }

    scheduleExecutionUIUpdate(attempt = 1) {
        if (attempt > 5) {
            console.warn('⚠️ Failed to update execution UI after 5 attempts');
            return;
        }

        const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000); // Exponential backoff, max 2s
        
        setTimeout(() => {
            if (window.updateExecutionUI) {
                try {
                    window.updateExecutionUI();
                    console.log(`✅ Execution UI updated on attempt ${attempt}`);
                } catch (error) {
                    console.warn(`⚠️ Execution UI update attempt ${attempt} failed:`, error);
                    this.scheduleExecutionUIUpdate(attempt + 1);
                }
            } else {
                console.log(`⏳ Execution UI not ready, retrying... (attempt ${attempt})`);
                this.scheduleExecutionUIUpdate(attempt + 1);
            }
        }, delay);
    }

    log(message, type = 'info') {
        const logEl = document.getElementById('btLog');
        if (!logEl) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-type-${type}">${message}</span>
        `;

        logEl.appendChild(logEntry);

        if (this.autoScrollLog) {
            logEl.scrollTop = logEl.scrollHeight;
        }
    }

    clearLog() {
        const logEl = document.getElementById('btLog');
        if (logEl) {
            logEl.innerHTML = '';
        }
    }

    async connect(isAutoReconnect = false) {
        if (this.isConnecting || this.isConnected) return;

        try {
            // Clear any previous warning state
            this.clearWarningState();
            
            this.isConnecting = true;
            this.updateButtonState();
            this.updateStatus('connecting');
            
            if (isAutoReconnect) {
                this.log('🔄 Auto-reconnecting to device...', 'info');
            } else {
                this.log('🔍 Requesting Bluetooth device...', 'info');
            }

            // Show loading state on connect button
            const connectBtn = document.getElementById('btConnectBtn');
            if (connectBtn) {
                connectBtn.textContent = 'Connecting...';
            }

            // Build filters from config
            const filters = this.config ? 
                this.config.getDeviceNames().map(name => ({ name })) :
                [{ name: 'Santa-Bot' }]; // Fallback if config not loaded

            // Request device
            this.device = await navigator.bluetooth.requestDevice({
                filters: filters,
                optionalServices: [this.config ? this.config.serviceUUID : '0d9be2a0-4757-43d9-83df-704ae274b8df']
            });

            this.log(`📡 Connecting to ${this.device.name} GATT server...`, 'info');
            const server = await this.device.gatt.connect();

            this.log('🔍 Getting Robot Control service...', 'info');
            const service = await server.getPrimaryService(this.config ? this.config.serviceUUID : '0d9be2a0-4757-43d9-83df-704ae274b8df');

            this.log('🔍 Getting Command & Response characteristic...', 'info');
            this.characteristic = await service.getCharacteristic(this.config ? this.config.characteristicUUID : '8116d8c0-d45d-4fdf-998e-33ab8c471d59');

            // Set up notification listener
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleNotification(event);
            });

            // Set up disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                this.log('� Device disconnected', 'warning');
                this.handleUnexpectedDisconnect();
            });

            await this.characteristic.startNotifications();
            this.log('🔔 Started listening for notifications', 'info');

            this.isConnected = true;
            this.isConnecting = false;
            this.lastConnectionTime = Date.now();
            this.updateButtonState();
            this.updateStatus('connected');
            this.log(`✅ Connected successfully to ${this.device.name}!`, 'success');

            // Update execution UI to enable run button
            this.updateExecutionUI();

            // Save session data
            this.saveSessionData();

            // Show success toast
            if (window.toast) {
                window.toast.success(`Connected to ${this.device.name}!`);
            }

            // If we have cached tools, load them immediately into dropdowns
            if (this.availableTools.length > 0) {
                this.loadToolsIntoDropdowns();
            }

            // Request available tools (will update if different from cached)
            setTimeout(() => {
                this.requestTools();
            }, 1000);

        } catch (error) {
            this.isConnecting = false;
            this.isConnected = false;
            this.updateButtonState();
            this.updateStatus('disconnected');
            this.log(`❌ Connection failed: ${error.message}`, 'error');
            
            if (window.toast) {
                window.toast.error(`Connection failed: ${error.message}`);
            }
        } finally {
            // Remove loading state from connect button
            const connectBtn = document.getElementById('btConnectBtn');
            if (connectBtn) {
                connectBtn.textContent = 'Connect to Device';
            }
        }
    }

    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        // Note: Don't clear availableTools on disconnect to keep them cached
        this.updateButtonState();
        this.updateStatus('disconnected');
        this.updateToolsList();
        this.log('🔌 Disconnected from device', 'info');
        
        // Stop any running execution and update UI
        if (window.handleBluetoothDisconnection) {
            window.handleBluetoothDisconnection();
        }
        
        // Update execution UI to disable run button
        this.updateExecutionUI();
        
        // Update session data to reflect disconnection
        this.saveSessionData();
        
        if (window.toast) {
            window.toast.info('Disconnected from Santa-Bot');
        }
    }

    handleUnexpectedDisconnect() {
        this.isConnected = false;
        this.isConnecting = false;
        this.updateButtonState();
        this.updateStatus('disconnected');
        this.updateToolsList(); // Keep tools cached
        
        // Save session data
        this.saveSessionData();
        
        // Stop any running execution and update UI
        if (window.handleBluetoothDisconnection) {
            window.handleBluetoothDisconnection();
        }
        
        // Update execution UI to disable run button
        this.updateExecutionUI();
        
        if (window.toast) {
            window.toast.warning('Santa-Bot disconnected unexpectedly');
        }
        
        // Offer to reconnect after a delay
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.log('🔄 Offering to reconnect...', 'info');
                if (window.toast) {
                    window.toast.info('Click Bluetooth button to reconnect', { duration: 5000 });
                }
            }
        }, 3000);
    }

    handleNotification(event) {
        const response = new TextDecoder().decode(event.target.value);
        this.log(`📥 Raw BLE notification (${response.length} bytes)`, 'received');

        try {
            const parsed = JSON.parse(response);
            
            if (parsed.chunk) {
                this.log(`🧩 Handling chunked message (${parsed.chunk.index + 1}/${parsed.chunk.total})`, 'info');
                this.handleChunkedMessage(parsed.chunk);
            } else if (parsed.type === 'mcp_response') {
                this.log('🔧 Processing MCP response', 'success');
                this.log(`🔍 MCP payload check: ${parsed.payload ? 'EXISTS' : 'MISSING'}`, 'info');
                if (parsed.payload) {
                    this.handleMcpResponse(parsed.payload);
                } else {
                    this.log(`❌ MCP response has no payload`, 'error');
                }
            } else if (parsed.type === 'response' && parsed.text) {
                this.log(`📝 Text Response: "${parsed.text}"`, 'success');
            }
        } catch (e) {
            this.log(`❌ JSON parsing failed: ${e.message}`, 'error');
            this.log(`💬 Plain text response: "${response}"`, 'info');
        }
    }

    handleChunkedMessage(chunk) {
        const { id, index, total, data } = chunk;
        
        this.log(`📦 Received chunk ${index + 1}/${total} for message ${id} (${data ? data.length : 0} bytes)`, 'info');
        
        // Validate chunk data
        if (!data) {
            this.log(`❌ Chunk ${index + 1}/${total} has no data`, 'error');
            return;
        }
        
        // Initialize storage for this message if needed
        if (!this.chunkedMessages.has(id)) {
            this.chunkedMessages.set(id, {
                chunks: new Array(total),
                receivedCount: 0,
                total: total
            });
            this.log(`🆕 Initialized storage for message ${id} expecting ${total} chunks`, 'info');
        }
        
        const messageData = this.chunkedMessages.get(id);
        
        // Store this chunk (avoid duplicates)
        if (messageData.chunks[index] === undefined) {
            messageData.chunks[index] = data;
            messageData.receivedCount++;
            this.log(`📦 Stored chunk ${index + 1}/${total} (${messageData.receivedCount}/${total} received)`, 'info');
        } else {
            this.log(`⚠️ Duplicate chunk ${index + 1}/${total} ignored`, 'info');
            return;
        }
        
        // Check if we have all chunks
        if (messageData.receivedCount === messageData.total) {
            // Reassemble the complete message by joining all chunks
            const completeMessage = messageData.chunks.join('');
            this.log(`🔧 Reassembling message ${id}: ${messageData.total} chunks → ${completeMessage.length} bytes`, 'info');
            
            // Log the reconstructed payload for debugging
            const preview = completeMessage.length > 100 ? 
                completeMessage.substring(0, 100) + '...' : 
                completeMessage;
            this.log(`📄 Reconstructed payload preview: ${preview}`, 'info');
            
            // Clean up chunk storage
            this.chunkedMessages.delete(id);
            
            // Process the complete message
            try {
                const parsed = JSON.parse(completeMessage);
                this.log(`✅ Message ${id} successfully reconstructed and parsed`, 'success');
                
                if (parsed.type === 'response' && parsed.text) {
                    this.log(`📝 Text Response: "${parsed.text}"`, 'success');
                } else if (parsed.type === 'mcp_response') {
                    this.log(`🔧 Processing reconstructed MCP response (${completeMessage.length} bytes)`, 'success');
                    this.log(`🔍 MCP payload check: ${parsed.payload ? 'EXISTS' : 'MISSING'}`, 'info');
                    if (parsed.payload) {
                        this.handleMcpResponse(parsed.payload);
                    } else {
                        this.log(`❌ MCP response has no payload`, 'error');
                    }
                } else {
                    this.log(`📋 Other message type: ${parsed.type}`, 'info');
                }
            } catch (e) {
                this.log(`❌ Failed to parse reconstructed message: ${e.message}`, 'error');
                this.log(`📄 Raw content: ${completeMessage.substring(0, 200)}...`, 'error');
            }
        } else {
            this.log(`⏳ Waiting for ${messageData.total - messageData.receivedCount} more chunks...`, 'info');
            
            // Debug: show which chunks we have so far
            const receivedIndices = [];
            for (let i = 0; i < messageData.chunks.length; i++) {
                if (messageData.chunks[i] !== undefined) {
                    receivedIndices.push(i);
                }
            }
            this.log(`📊 Current chunks received: [${receivedIndices.join(', ')}]`, 'info');
        }
    }

    handleMcpResponse(payload) {
        // Handle tools/list responses (tool discovery)
        if (payload && payload.result && payload.result.tools) {
            const tools = payload.result.tools;
            this.log(`📋 Found ${tools.length} available tools`, 'success');
            this.availableTools = tools;
            this.updateToolsList();
            
            // Save updated session data with new tools
            this.saveSessionData();
            
            // Show toast notification
            // if (window.toast) {
            //     window.toast.santa(`MCP tooling updated! Found ${tools.length} tools`);
            // }
            
            // Update Santa command dropdowns in blocks
            if (window.updateSantaCommandDropdowns) {
                window.updateSantaCommandDropdowns(tools);
            }
        } else if (payload && payload.result !== undefined) {
            // Handle tools/call responses (function execution results)
            this.log('🔧 Tool execution response received', 'info');
            if (payload.result.content) {
                this.log(`📄 Execution result: ${JSON.stringify(payload.result.content)}`, 'success');
            }
        } else if (payload && payload.error) {
            // Handle MCP error responses
            this.log(`❌ MCP Error: ${payload.error.message || 'Unknown error'}`, 'error');
            if (window.toast) {
                window.toast.error(`Tool execution failed: ${payload.error.message || 'Unknown error'}`);
            }
        } else {
            // Log unknown response format but don't treat as critical error
            this.log('📨 Unknown MCP response format - ignoring', 'info');
            this.log(`🔍 Payload structure: ${JSON.stringify(payload, null, 2)}`, 'debug');
        }
    }

    updateToolsList() {
        const toolsList = document.getElementById('btToolsList');
        if (!toolsList) return;

        if (this.availableTools.length === 0) {
            toolsList.innerHTML = '<div class="no-tools">No tools loaded yet</div>';
        } else {
            const statusText = this.isConnected ? '' : ' (cached)';
            const toolItems = this.availableTools.map(tool => 
                `<div class="tool-item" title="${tool.description || tool.name}">${tool.name}</div>`
            ).join('');
            
            let html = toolItems;
            if (!this.isConnected && this.availableTools.length > 0) {
                html = `<div class="tools-status">📂 ${this.availableTools.length} cached tools from previous session</div>` + html;
            }
            
            toolsList.innerHTML = html;
        }
    }

    async requestTools() {
        if (!this.isConnected) return;

        const mcpRequest = {
            type: 'mcp',
            payload: {
                method: 'tools/list',
                params: {}
            }
        };

        this.log('📋 Requesting available tools from MCP server', 'info');
        await this.sendMessage(mcpRequest);
    }

    async manualReloadTools() {
        if (!this.isConnected) {
            this.log('❌ Cannot reload tools: not connected to device', 'error');
            if (window.toast) {
                window.toast.error('Not connected to Santa-Bot');
            }
            return;
        }

        this.log('🔄 Manually reloading MCP tools...', 'info');
        if (window.toast) {
            window.toast.info('Reloading MCP tools...');
        }

        await this.requestTools();
    }

    async sendMessage(message) {
        if (!this.isConnected || !this.characteristic) {
            this.log('❌ Not connected to device', 'error');
            return false;
        }

        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const messageBytes = new TextEncoder().encode(messageStr);
            
            // Simple send for now - can implement chunking later if needed
            if (messageBytes.length > 200) {
                this.log(`⚠️ Message too large (${messageBytes.length} bytes), chunking not implemented yet`, 'warning');
                return false;
            }

            await this.characteristic.writeValue(messageBytes);
            this.log(`📤 Sent message (${messageBytes.length} bytes)`, 'info');
            return true;
        } catch (error) {
            this.log(`❌ Failed to send message: ${error.message}`, 'error');
            return false;
        }
    }

    // Public methods for external use
    isDeviceConnected() {
        return this.isConnected;
    }

    getAvailableTools() {
        return this.availableTools;
    }

    async executeToolByName(toolName, parameters = {}) {
        if (!this.isConnected) {
            this.log('❌ Cannot execute tool: not connected', 'error');
            return false;
        }

        const originalParameters = parameters;
        let convertedParameters;
        // Prefer global interpreter's pseudoToNative if available and parameters look like interpreter objects
        try {
            if (window.xiaozhiInterpreter && window.xiaozhiInterpreter.interpreter && window.xiaozhiInterpreter.interpreter.pseudoToNative) {
                convertedParameters = window.xiaozhiInterpreter.interpreter.pseudoToNative(parameters);
            }
        } catch (e) {
            console.warn('pseudoToNative (global) failed, falling back to manual conversion', e);
        }
    if (!convertedParameters) convertedParameters = parameters || {};

        // Determine expected parameter names from tool schema (if known)
        let expectedParams = [];
        const tool = this.availableTools.find(t => t.name === toolName);
        if (tool && tool.inputSchema && tool.inputSchema.properties) {
            expectedParams = Object.keys(tool.inputSchema.properties);
        }

        // Compare expected vs provided
        const providedKeys = Object.keys(convertedParameters);
        const missingKeys = expectedParams.filter(k => !providedKeys.includes(k));

        // Minimal debug if something missing
        if (missingKeys.length) {
            console.warn(`⚠️ Missing expected parameter keys for ${toolName}:`, missingKeys);
        }

        const mcpRequest = {
            type: 'mcp',
            payload: {
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: convertedParameters
                }
            }
        };

        this.log(`🔧 Executing tool: ${toolName}`, 'info');
    // Optional concise payload log
    try { console.log('📤 MCP Params:', JSON.stringify(mcpRequest.payload.params)); } catch (e) {}
        return await this.sendMessage(mcpRequest);
    }
}

// Global functions for interpreter and external use
window.executeSantaCommand = async function(toolName, parameters = {}) {
    if (window.bluetoothController) {
        return await window.bluetoothController.executeToolByName(toolName, parameters);
    } else {
        console.log('⚠️ Bluetooth controller not available, simulating command:', toolName);
        return false;
    }
};

window.sendMessage = async function(message) {
    if (window.bluetoothController) {
        return await window.bluetoothController.sendMessage(message);
    } else {
        console.log('⚠️ Bluetooth controller not available, simulating message send:', message);
        return false;
    }
};

window.getSantaTools = function() {
    if (window.bluetoothController) {
        return window.bluetoothController.getAvailableTools();
    } else {
        console.log('⚠️ Bluetooth controller not available');
        return [];
    }
};

window.isBluetoothConnected = function() {
    if (window.bluetoothController) {
        return window.bluetoothController.isDeviceConnected();
    } else {
        return false;
    }
};

// Robust initialization for cloud hosting
function initializeBluetoothController() {
    try {
        window.bluetoothController = new BluetoothController();
        
        // Make it available as bleManager for compatibility with existing code
        window.bleManager = window.bluetoothController;
        
        console.log('✅ Bluetooth controller initialized successfully');
        
        // Ensure execution UI is updated after a delay to handle timing issues
        setTimeout(() => {
            if (window.bluetoothController) {
                window.bluetoothController.updateExecutionUI();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Failed to initialize Bluetooth controller:', error);
        // Retry after a short delay
        setTimeout(initializeBluetoothController, 1000);
    }
}

// Multiple initialization strategies for robustness on cloud hosting
if (document.readyState === 'loading') {
    // DOM is still loading
    document.addEventListener('DOMContentLoaded', initializeBluetoothController);
} else {
    // DOM is already loaded
    initializeBluetoothController();
}

// Fallback initialization after window load
window.addEventListener('load', () => {
    if (!window.bluetoothController) {
        console.log('🔄 Fallback: Initializing Bluetooth controller after window load');
        initializeBluetoothController();
    }
});
