// Bluetooth Device Configuration
// This file defines all supported Bluetooth devices for the Block-Xiaozhi platform

const BluetoothDeviceConfig = {
    // Common GATT Service UUID used across all device types
    // This represents the "Robot Control Protocol" interface
    serviceUUID: '0d9be2a0-4757-43d9-83df-704ae274b8df',
    
    // Characteristic UUID for commands and responses
    characteristicUUID: '8116d8c0-d45d-4fdf-998e-33ab8c471d59',
    
    // Supported device types
    // Add new devices here to expand compatibility
    // Description and icon are optional, for UI purposes
    devices: [
        {
            name: 'Santa-Bot',
            type: 'santa',
            description: 'Original Santa-Bot robot',
            icon: '🎅'
        },
        {
            name: 'Minipupper-v2',
            type: 'dog',
            description: 'Quadruped robot platform',
            icon: '🐕'
        }
        
    ],
    
    // Helper methods
    getDeviceNames() {
        return this.devices.map(device => device.name);
    },
    
    getDeviceByName(name) {
        return this.devices.find(device => device.name === name);
    },
    
    getDeviceType(deviceName) {
        const device = this.getDeviceByName(deviceName);
        return device ? device.type : 'unknown';
    },
    
    isSupported(deviceName) {
        return this.devices.some(device => device.name === deviceName);
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.BluetoothDeviceConfig = BluetoothDeviceConfig;
}
