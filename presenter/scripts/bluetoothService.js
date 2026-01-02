// Bluetooth Service for Presenter
// Handles Web Bluetooth connection and MCP communication with multiple MiniPuppers
// Supports MCP tool discovery and execution

// Use same UUIDs as main app
const SERVICE_UUID = '0d9be2a0-4757-43d9-83df-704ae274b8df';
const CHARACTERISTIC_UUID = '8116d8c0-d45d-4fdf-998e-33ab8c471d59';

class BluetoothService {
    constructor() {
        this.robots = new Map(); // Map of robot ID -> robot object
        this.nextRobotId = 1;
        this.onRobotsChange = null; // Callback when robots list changes
        this.onToolsReceived = null; // Callback when tools are received
        this.onMessage = null; // Callback for other messages
        
        // Shared tools list (assumes all MiniPuppers have same tools)
        this.availableTools = [];
        this.toolsLoaded = false;
        
        // Chunked message handling
        this.chunkedMessages = new Map();
        
        // Load cached tools from localStorage
        this.loadCachedTools();
    }

    get isConnected() {
        return this.robots.size > 0;
    }

    getRobots() {
        return Array.from(this.robots.values());
    }

    getRobot(robotId) {
        return this.robots.get(robotId);
    }

    getConnectedCount() {
        return this.robots.size;
    }

    getAvailableTools() {
        return this.availableTools;
    }

    isToolsLoaded() {
        return this.toolsLoaded && this.availableTools.length > 0;
    }

    // ==================== Tool Caching ====================

    loadCachedTools() {
        try {
            const cached = localStorage.getItem('presenter_mcp_tools');
            if (cached) {
                const data = JSON.parse(cached);
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                if (data.timestamp && (Date.now() - data.timestamp) < sevenDays) {
                    this.availableTools = data.tools || [];
                    this.toolsLoaded = this.availableTools.length > 0;
                    console.log(`Loaded ${this.availableTools.length} cached MCP tools`);
                }
            }
        } catch (e) {
            console.warn('Failed to load cached tools:', e);
        }
    }

    saveCachedTools() {
        try {
            const data = {
                timestamp: Date.now(),
                tools: this.availableTools
            };
            localStorage.setItem('presenter_mcp_tools', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to cache tools:', e);
        }
    }

    // ==================== Connection Management ====================

    async connect() {
        try {
            // Request Bluetooth device
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: 'Minipupper-v2' },
                    { namePrefix: 'Micropupper' },
                    { namePrefix: 'Santa' }
                ],
                optionalServices: [SERVICE_UUID]
            });

            // Check if already connected
            for (const [id, robot] of this.robots.entries()) {
                if (robot.device.id === device.id) {
                    console.log('Device already connected:', device.name);
                    return robot;
                }
            }

            console.log('Device selected:', device.name);

            // Connect to GATT server
            const server = await device.gatt.connect();
            console.log('Connected to GATT server');

            // Get service
            const service = await server.getPrimaryService(SERVICE_UUID);
            console.log('Got service');

            // Get characteristic
            const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
            console.log('Got characteristic');

            // Start notifications
            await characteristic.startNotifications();
            
            const robotId = this.nextRobotId++;
            
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleNotification(robotId, event);
            });

            // Create robot object
            const robot = {
                id: robotId,
                device: device,
                characteristic: characteristic,
                name: device.name || `Robot ${robotId}`,
                connectedAt: new Date()
            };

            // Handle disconnection
            device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection(robotId);
            });

            // Add to robots map
            this.robots.set(robotId, robot);

            // Notify listeners
            if (this.onRobotsChange) {
                this.onRobotsChange();
            }

            // Request tools from the first robot (they should all have the same tools)
            if (this.robots.size === 1 || !this.toolsLoaded) {
                setTimeout(() => this.requestTools(robotId), 500);
            }

            return robot;
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        }
    }

    disconnect(robotId) {
        const robot = this.robots.get(robotId);
        if (robot && robot.device) {
            console.log('Manually disconnecting robot:', robot.name);
            robot.device.gatt.disconnect();
        }
    }

    disconnectAll() {
        console.log('Disconnecting all robots...');
        for (const [robotId, robot] of this.robots.entries()) {
            if (robot.device) {
                robot.device.gatt.disconnect();
            }
        }
    }

    handleDisconnection(robotId) {
        const robot = this.robots.get(robotId);
        if (robot) {
            console.log('Robot disconnected:', robot.name);
            this.robots.delete(robotId);

            // Notify listeners
            if (this.onRobotsChange) {
                this.onRobotsChange();
            }
        }
    }

    // ==================== Message Handling ====================

    handleNotification(robotId, event) {
        const response = new TextDecoder().decode(event.target.value);
        console.log(`📥 Received from robot ${robotId} (${response.length} bytes)`);

        try {
            const parsed = JSON.parse(response);
            
            if (parsed.chunk) {
                // Handle chunked message
                this.handleChunkedMessage(robotId, parsed.chunk);
            } else if (parsed.type === 'mcp_response') {
                // Handle MCP response
                if (parsed.payload) {
                    this.handleMcpResponse(robotId, parsed.payload);
                }
            } else if (parsed.type === 'response' && parsed.text) {
                console.log(`📝 Text Response from robot ${robotId}: "${parsed.text}"`);
            }

            // Notify external listener
            if (this.onMessage) {
                this.onMessage(robotId, parsed);
            }
        } catch (e) {
            console.log('Non-JSON message:', response);
        }
    }

    handleChunkedMessage(robotId, chunk) {
        const { id, index, total, data } = chunk;
        
        console.log(`📦 Received chunk ${index + 1}/${total} for message ${id}`);
        
        if (!data) return;
        
        // Initialize storage for this message if needed
        const key = `${robotId}_${id}`;
        if (!this.chunkedMessages.has(key)) {
            this.chunkedMessages.set(key, {
                chunks: new Array(total),
                receivedCount: 0,
                total: total
            });
        }
        
        const messageData = this.chunkedMessages.get(key);
        
        // Store this chunk (avoid duplicates)
        if (messageData.chunks[index] === undefined) {
            messageData.chunks[index] = data;
            messageData.receivedCount++;
        } else {
            return; // Duplicate
        }
        
        // Check if we have all chunks
        if (messageData.receivedCount === messageData.total) {
            const completeMessage = messageData.chunks.join('');
            this.chunkedMessages.delete(key);
            
            try {
                const parsed = JSON.parse(completeMessage);
                
                if (parsed.type === 'mcp_response' && parsed.payload) {
                    this.handleMcpResponse(robotId, parsed.payload);
                }
            } catch (e) {
                console.error('Failed to parse reconstructed message:', e);
            }
        }
    }

    handleMcpResponse(robotId, payload) {
        // Handle tools/list response
        if (payload && payload.result && payload.result.tools) {
            const tools = payload.result.tools;
            console.log(`📋 Received ${tools.length} MCP tools from robot ${robotId}`);
            
            this.availableTools = tools;
            this.toolsLoaded = true;
            this.saveCachedTools();
            
            // Notify listeners
            if (this.onToolsReceived) {
                this.onToolsReceived(tools);
            }
        } else if (payload && payload.result !== undefined) {
            // Handle tools/call response
            console.log('🔧 Tool execution response:', payload.result);
        } else if (payload && payload.error) {
            console.error('❌ MCP Error:', payload.error.message || 'Unknown error');
        }
    }

    // ==================== Tool Discovery ====================

    /**
     * Request the list of available MCP tools from a robot
     */
    async requestTools(robotId = null) {
        // Use first connected robot if not specified
        if (robotId === null) {
            const firstRobot = this.robots.values().next().value;
            if (!firstRobot) {
                console.warn('No robots connected to request tools from');
                return false;
            }
            robotId = firstRobot.id;
        }

        const robot = this.robots.get(robotId);
        if (!robot || !robot.characteristic) {
            console.warn('Robot not found or not connected');
            return false;
        }

        const mcpRequest = {
            type: 'mcp',
            payload: {
                method: 'tools/list',
                params: {}
            }
        };

        console.log('📋 Requesting MCP tools list...');
        return await this.sendToRobot(robotId, mcpRequest);
    }

    /**
     * Refresh the tools list from connected robots
     */
    async refreshTools() {
        if (this.robots.size === 0) {
            console.warn('No robots connected');
            return false;
        }
        return await this.requestTools();
    }

    // ==================== Tool Execution ====================

    /**
     * Execute an MCP tool on a specific robot
     */
    async executeToolOnRobot(robotId, toolName, parameters = {}) {
        const robot = this.robots.get(robotId);
        if (!robot || !robot.characteristic) {
            throw new Error(`Robot ${robotId} not connected`);
        }

        const mcpRequest = {
            type: 'mcp',
            payload: {
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: parameters
                }
            }
        };

        console.log(`🔧 Executing tool ${toolName} on ${robot.name}`);
        return await this.sendToRobot(robotId, mcpRequest);
    }

    /**
     * Execute an MCP tool on all connected robots
     */
    async executeToolOnAll(toolName, parameters = {}) {
        const results = [];
        
        for (const [robotId, robot] of this.robots.entries()) {
            try {
                await this.executeToolOnRobot(robotId, toolName, parameters);
                results.push({ robotId, robotName: robot.name, success: true });
            } catch (error) {
                results.push({ robotId, robotName: robot.name, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Send a message to a specific robot
     */
    async sendToRobot(robotId, message) {
        const robot = this.robots.get(robotId);
        if (!robot || !robot.characteristic) {
            throw new Error(`Robot ${robotId} not connected`);
        }

        try {
            const messageStr = JSON.stringify(message);
            const encoder = new TextEncoder();
            const data = encoder.encode(messageStr);

            if (data.length > 200) {
                console.warn(`Message size (${data.length} bytes) may exceed BLE MTU`);
            }

            await robot.characteristic.writeValue(data);
            console.log(`📤 Sent to ${robot.name} (${data.length} bytes)`);
            return true;
        } catch (error) {
            console.error(`Failed to send to ${robot.name}:`, error);
            throw error;
        }
    }

    /**
     * Send a message to all connected robots
     */
    async sendToAll(message) {
        const results = [];
        
        for (const [robotId, robot] of this.robots.entries()) {
            try {
                await this.sendToRobot(robotId, message);
                results.push({ robotId, robotName: robot.name, success: true });
            } catch (error) {
                results.push({ robotId, robotName: robot.name, success: false, error: error.message });
            }
        }

        return results;
    }

    // ==================== Program Control Messages ====================

    /**
     * Send 'Wake Up' message to all robots (start flag)
     * This alerts robots that a new program sequence is starting
     */
    async sendWakeUp() {
        const message = {
            type: 'text',
            text: 'Wake Up'
        };
        
        console.log('📢 Sending Wake Up to all robots...');
        return await this.sendToAll(message);
    }

    /**
     * Send quit command to all robots (stop flag)
     * This resets the robot to a neutral/rest position
     */
    async sendQuit() {
        console.log('🛑 Sending quit command to all robots...');
        return await this.executeToolOnAll('self.system.quit', {});
    }

    // ==================== Tool Helper Methods ====================

    /**
     * Get a tool by name
     */
    getTool(toolName) {
        return this.availableTools.find(t => t.name === toolName);
    }

    /**
     * Get the input schema for a tool
     */
    getToolSchema(toolName) {
        const tool = this.getTool(toolName);
        return tool ? tool.inputSchema : null;
    }

    /**
     * Get the parameter definitions for a tool
     */
    getToolParameters(toolName) {
        const schema = this.getToolSchema(toolName);
        if (!schema || !schema.properties) {
            return [];
        }

        const required = schema.required || [];
        
        return Object.entries(schema.properties).map(([name, prop]) => ({
            name,
            type: prop.type || 'string',
            description: prop.description || '',
            required: required.includes(name),
            enum: prop.enum || null,
            default: prop.default,
            minimum: prop.minimum,
            maximum: prop.maximum
        }));
    }

    /**
     * Validate parameters for a tool
     */
    validateToolParameters(toolName, parameters) {
        const tool = this.getTool(toolName);
        if (!tool) {
            return { valid: false, errors: ['Tool not found'] };
        }

        const schema = tool.inputSchema;
        if (!schema) {
            return { valid: true, errors: [] };
        }

        const errors = [];
        const required = schema.required || [];

        // Check required parameters
        for (const paramName of required) {
            if (parameters[paramName] === undefined || parameters[paramName] === null || parameters[paramName] === '') {
                errors.push(`Required parameter '${paramName}' is missing`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export as singleton
window.bluetoothService = new BluetoothService();
