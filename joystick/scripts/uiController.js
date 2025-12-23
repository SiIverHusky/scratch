// UI Controller
// Handles HTML behavior and user interactions

class UIController {
    constructor(gamepadMapper, bluetoothService) {
        this.gamepadMapper = gamepadMapper;
        this.bluetoothService = bluetoothService;
        this.joystickActiveLeft = false;
        this.joystickActiveRight = false;

        this.init();
    }

    init() {
        // Connect button
        document.getElementById('connectBtn').addEventListener('click', () => this.handleConnect());

        // Initialize joysticks
        this.initJoystick('left', 
            document.getElementById('leftJoystick'), 
            document.getElementById('leftStick')
        );
        this.initJoystick('right', 
            document.getElementById('rightJoystick'), 
            document.getElementById('rightStick')
        );

        // Initialize buttons
        this.initDisconnectButton();
        this.initButton('btnR1', 'R1');

        // Initialize D-pad
        this.initDpad();
    }

    async handleConnect() {
        try {
            this.updateStatus('connecting', 'Connecting...');
            document.getElementById('connectBtn').disabled = true;

            await this.bluetoothService.connect();

            this.updateStatus('connected', 'Connected');
            document.getElementById('controls').classList.add('active');

            // Start sending updates
            this.bluetoothService.startUpdates(() => this.gamepadMapper.getState());

            // Set disconnect callback
            this.bluetoothService.onDisconnect = () => this.handleDisconnect();

        } catch (error) {
            this.updateStatus('disconnected', 'Connection failed');
            document.getElementById('connectBtn').disabled = false;
            alert('Connection failed: ' + error.message);
        }
    }

    handleDisconnect() {
        this.updateStatus('disconnected', 'Disconnected');
        document.getElementById('controls').classList.remove('active');
        document.getElementById('connectBtn').disabled = false;
    }

    updateStatus(status, text) {
        const statusEl = document.getElementById('status');
        statusEl.className = 'status ' + status;
        statusEl.textContent = text;
    }

    initJoystick(side, container, stick) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const maxRadius = rect.width / 2 - 30; // Account for stick size

        let isDragging = false;

        const updateStickPosition = (clientX, clientY) => {
            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            let x = clientX - rect.left - centerX;
            let y = clientY - rect.top - centerY;

            // Limit to circular boundary
            const distance = Math.sqrt(x * x + y * y);
            if (distance > maxRadius) {
                const angle = Math.atan2(y, x);
                x = Math.cos(angle) * maxRadius;
                y = Math.sin(angle) * maxRadius;
            }

            // Update visual position - invert both X and Y axes for visual display
            stick.style.transform = `translate(calc(-50% - ${x}px), calc(-50% - ${y}px))`;

            // Update state (-1.0 to 1.0)
            const normalizedX = x / maxRadius;
            const normalizedY = -y / maxRadius; // Invert Y for correct mechanical direction

            if (side === 'left') {
                this.gamepadMapper.setLeftStick(normalizedX, normalizedY);
                document.getElementById('infoLeft').textContent = 
                    `X: ${normalizedX.toFixed(2)}, Y: ${normalizedY.toFixed(2)}`;
            } else {
                this.gamepadMapper.setRightStick(normalizedX, normalizedY);
                document.getElementById('infoRight').textContent = 
                    `X: ${normalizedX.toFixed(2)}, Y: ${normalizedY.toFixed(2)}`;
            }
        };

        const resetStick = () => {
            stick.style.transform = 'translate(-50%, -50%)';
            if (side === 'left') {
                this.gamepadMapper.resetLeftStick();
                document.getElementById('infoLeft').textContent = 'X: 0.00, Y: 0.00';
            } else {
                this.gamepadMapper.resetRightStick();
                document.getElementById('infoRight').textContent = 'X: 0.00, Y: 0.00';
            }
        };

        // Mouse events
        stick.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateStickPosition(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resetStick();
            }
        });

        // Touch events
        stick.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length > 0) {
                updateStickPosition(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                resetStick();
            }
        });
    }

    initDisconnectButton() {
        const button = document.getElementById('btnDisconnect');
        button.addEventListener('click', () => {
            this.bluetoothService.disconnect();
        });
    }

    initButton(elementId, stateKey) {
        const button = document.getElementById(elementId);
        // All buttons are now momentary (not toggle) to work with edge detection
        // The robot's Controller.py handles the state machine internally

        const activate = () => {
            this.gamepadMapper.setButton(stateKey, 1);
        };

        const deactivate = () => {
            this.gamepadMapper.setButton(stateKey, 0);
        };

        button.addEventListener('mousedown', activate);
        button.addEventListener('mouseup', deactivate);
        button.addEventListener('mouseleave', deactivate);
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            activate();
        });
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            deactivate();
        });
    }

    initDpad() {
        const buttons = document.querySelectorAll('.dpad-btn:not(.empty)');

        buttons.forEach(btn => {
            const direction = btn.dataset.dpad;

            const activate = () => {
                switch(direction) {
                    case 'up':
                        this.gamepadMapper.setDpadUp(true);
                        break;
                    case 'down':
                        this.gamepadMapper.setDpadDown(true);
                        break;
                    case 'left':
                        this.gamepadMapper.setDpadLeft(true);
                        break;
                    case 'right':
                        this.gamepadMapper.setDpadRight(true);
                        break;
                }
                this.updateDpadInfo();
            };

            const deactivate = () => {
                switch(direction) {
                    case 'up':
                        this.gamepadMapper.setDpadUp(false);
                        break;
                    case 'down':
                        this.gamepadMapper.setDpadDown(false);
                        break;
                    case 'left':
                        this.gamepadMapper.setDpadLeft(false);
                        break;
                    case 'right':
                        this.gamepadMapper.setDpadRight(false);
                        break;
                }
                this.updateDpadInfo();
            };

            btn.addEventListener('mousedown', activate);
            btn.addEventListener('mouseup', deactivate);
            btn.addEventListener('mouseleave', deactivate);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                activate();
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                deactivate();
            });
        });
    }

    updateDpadInfo() {
        const state = this.gamepadMapper.getState();
        document.getElementById('infoDpad').textContent = 
            `X: ${state.dpadx}, Y: ${state.dpady}`;
    }
}

// Initialize controller when page loads
window.addEventListener('DOMContentLoaded', () => {
    const gamepadMapper = new GamepadMapper();
    const bluetoothService = new BluetoothService();
    const uiController = new UIController(gamepadMapper, bluetoothService);
});
