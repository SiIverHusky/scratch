// Bluetooth Service
// Handles Web Bluetooth connection and communication with MiniPupper

const SERVICE_UUID = '0d9be2a0-4757-43d9-83df-704ae274b8df';
const CHARACTERISTIC_UUID = '8116d8c0-d45d-4fdf-998e-33ab8c471d59';

class BluetoothService {
    constructor() {
        this.device = null;
        this.characteristic = null;
        this.isConnected = false;
        this.updateInterval = null;
        this.onStatusChange = null;
        this.onDisconnect = null;
    }

    async connect() {
        try {
            // Request Bluetooth device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'Minipupper-v2' }],
                optionalServices: [SERVICE_UUID]
            });

            console.log('Device selected:', this.device.name);

            // Connect to GATT server
            const server = await this.device.gatt.connect();
            console.log('Connected to GATT server');

            // Get service
            const service = await server.getPrimaryService(SERVICE_UUID);
            console.log('Got service');

            // Get characteristic
            this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
            console.log('Got characteristic');

            // Start notifications
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleNotification(event.target.value);
            });

            this.isConnected = true;

            // Handle disconnection
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });

            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        }
    }

    disconnect() {
        if (this.isConnected && this.device) {
            console.log('Manually disconnecting...');
            this.device.gatt.disconnect();
        }
    }

    handleDisconnection() {
        console.log('Device disconnected');
        this.isConnected = false;
        this.stopUpdates();
        if (this.onDisconnect) {
            this.onDisconnect();
        }
    }

    startUpdates(callback) {
        // Send state updates at 20Hz (50ms interval)
        this.updateInterval = setInterval(() => {
            if (callback) {
                const state = callback();
                this.sendState(state);
            }
        }, 50);
    }

    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async sendState(state) {
        if (!this.isConnected || !this.characteristic) return;

        try {
            const message = {
                type: 'joystick',
                data: state
            };

            const json = JSON.stringify(message);
            const encoder = new TextEncoder();
            const data = encoder.encode(json);

            await this.characteristic.writeValue(data);
        } catch (error) {
            console.error('Failed to send state:', error);
        }
    }

    handleNotification(value) {
        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        console.log('Received:', text);
    }
}
