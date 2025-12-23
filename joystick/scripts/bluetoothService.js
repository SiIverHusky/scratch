// Bluetooth Service
// Handles Web Bluetooth connection and communication with MiniPupper

const SERVICE_UUID = '0d9be2a0-4757-43d9-83df-704ae274b8df';
const CHARACTERISTIC_UUID = '8116d8c0-d45d-4fdf-998e-33ab8c471d59';

class BluetoothService {
    constructor() {
        this.robots = new Map(); // Map of robot ID -> robot object
        this.updateInterval = null;
        this.onRobotsChange = null; // Callback when robots list changes
        this.nextRobotId = 1;
    }

    get isConnected() {
        return this.robots.size > 0;
    }

    getRobots() {
        return Array.from(this.robots.values());
    }

    getConnectedCount() {
        return this.robots.size;
    }

    async connect() {
        try {
            // Request Bluetooth device
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'Minipupper-v2' }],
                optionalServices: [SERVICE_UUID]
            });

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
            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleNotification(event.target.value);
            });

            // Create robot object
            const robotId = this.nextRobotId++;
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

            // Start updates if this is the first robot
            if (this.robots.size === 1) {
                this.startUpdates();
            }

            // Notify listeners
            if (this.onRobotsChange) {
                this.onRobotsChange();
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

            // Stop updates if no robots left
            if (this.robots.size === 0) {
                this.stopUpdates();
            }

            // Notify listeners
            if (this.onRobotsChange) {
                this.onRobotsChange();
            }
        }
    }

    startUpdates(callback) {
        // Send state updates at 20Hz (50ms interval)
        this.updateCallback = callback;
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => {
                if (this.updateCallback) {
                    const state = this.updateCallback();
                    this.sendStateToAll(state);
                }
            }, 50);
        }
    }

    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async sendStateToAll(state) {
        const message = {
            type: 'joystick',
            data: state
        };

        const json = JSON.stringify(message);
        const encoder = new TextEncoder();
        const data = encoder.encode(json);

        // Send to all connected robots
        for (const [robotId, robot] of this.robots.entries()) {
            try {
                if (robot.characteristic) {
                    await robot.characteristic.writeValue(data);
                }
            } catch (error) {
                console.error(`Failed to send state to ${robot.name}:`, error);
            }
        }
    }

    handleNotification(value) {
        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        console.log('Received:', text);
    }
}
