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
        // Header connect button - initial connection
        document.getElementById('connectBtn').addEventListener('click', () => this.handleConnect());

        // Robot management buttons in controls area
        document.getElementById('btnConnectNew').addEventListener('click', () => this.handleConnect());
        document.getElementById('btnDisconnectOne').addEventListener('click', () => this.openManageModal());
        document.getElementById('btnDisconnectAll').addEventListener('click', () => this.handleDisconnectAll());

        // Modal controls
        document.getElementById('modalClose').addEventListener('click', () => this.closeManageModal());

        // Close modal on background click
        document.getElementById('manageModal').addEventListener('click', (e) => {
            if (e.target.id === 'manageModal') {
                this.closeManageModal();
            }
        });

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
        this.initButton('btnR1', 'R1');

        // Initialize D-pad
        this.initDpad();

        // Listen for robot list changes
        this.bluetoothService.onRobotsChange = () => this.updateRobotsList();
    }

    async handleConnect() {
        try {
            this.updateStatus('connecting', 'Connecting...');
            document.getElementById('connectBtn').disabled = true;

            const robot = await this.bluetoothService.connect();

            console.log('Robot connected:', robot.name);

            // Start sending updates if this is the first robot
            if (this.bluetoothService.getConnectedCount() === 1) {
                this.bluetoothService.startUpdates(() => this.gamepadMapper.getState());
                document.getElementById('controls').classList.add('active');
            }

            document.getElementById('connectBtn').disabled = false;

        } catch (error) {
            document.getElementById('connectBtn').disabled = false;
            this.updateRobotsList(); // Refresh status display
            
            // Only show alert if user didn't cancel
            if (error.name !== 'NotFoundError') {
                alert('Connection failed: ' + error.message);
            }
        }
    }

    handleDisconnectAll() {
        if (this.bluetoothService.getConnectedCount() > 0) {
            this.bluetoothService.disconnectAll();
        }
    }

    updateRobotsList() {
        const robots = this.bluetoothService.getRobots();
        const count = robots.length;
        const robotsSection = document.getElementById('robotsSection');
        const robotCount = document.getElementById('robotCount');

        // Update status
        if (count === 0) {
            this.updateStatus('disconnected', 'Disconnected');
            document.getElementById('controls').classList.remove('active');
            robotsSection.style.display = 'none';
        } else {
            this.updateStatus('connected', `${count} robot${count > 1 ? 's' : ''} connected`);
            robotsSection.style.display = 'block';
            robotCount.textContent = count;
        }

        // Update modal list if open
        this.updateModalList();
    }

    openManageModal() {
        document.getElementById('manageModal').classList.add('show');
        this.updateModalList();
    }

    closeManageModal() {
        document.getElementById('manageModal').classList.remove('show');
    }

    updateModalList() {
        const modalList = document.getElementById('modalRobotsList');
        const robots = this.bluetoothService.getRobots();

        if (robots.length === 0) {
            modalList.innerHTML = `
                <div class="modal-empty-state">
                    <div class="empty-icon">🐕</div>
                    <p>No robots connected</p>
                </div>
            `;
            return;
        }

        modalList.innerHTML = '';
        
        robots.forEach(robot => {
            const item = document.createElement('div');
            item.className = 'modal-robot-item';
            
            const connectedTime = this.getTimeSince(robot.connectedAt);
            
            item.innerHTML = `
                <div class="modal-robot-info">
                    <div class="modal-robot-icon">🐕</div>
                    <div class="modal-robot-details">
                        <div class="modal-robot-name">${robot.name}</div>
                        <div class="modal-robot-time">Connected ${connectedTime}</div>
                    </div>
                </div>
                <button class="modal-robot-disconnect" data-robot-id="${robot.id}">
                    Disconnect
                </button>
            `;

            // Add disconnect handler
            const disconnectBtn = item.querySelector('.modal-robot-disconnect');
            disconnectBtn.addEventListener('click', () => {
                this.bluetoothService.disconnect(robot.id);
                // Close modal if no more robots
                if (this.bluetoothService.getConnectedCount() <= 1) {
                    this.closeManageModal();
                }
            });

            modalList.appendChild(item);
        });
    }

    getTimeSince(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
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

            const infoText = `X: ${normalizedX.toFixed(2)}, Y: ${normalizedY.toFixed(2)}`;
            if (side === 'left') {
                this.gamepadMapper.setLeftStick(normalizedX, normalizedY);
                document.getElementById('infoLeft').textContent = infoText;
                document.getElementById('infoLeftBottom').textContent = infoText;
            } else {
                this.gamepadMapper.setRightStick(normalizedX, normalizedY);
                document.getElementById('infoRight').textContent = infoText;
                document.getElementById('infoRightBottom').textContent = infoText;
            }
        };

        const resetStick = () => {
            stick.style.transform = 'translate(-50%, -50%)';
            if (side === 'left') {
                this.gamepadMapper.resetLeftStick();
                document.getElementById('infoLeft').textContent = 'X: 0.00, Y: 0.00';
                document.getElementById('infoLeftBottom').textContent = 'X: 0.00, Y: 0.00';
            } else {
                this.gamepadMapper.resetRightStick();
                document.getElementById('infoRight').textContent = 'X: 0.00, Y: 0.00';
                document.getElementById('infoRightBottom').textContent = 'X: 0.00, Y: 0.00';
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
        const dpadText = `X: ${state.dpadx}, Y: ${state.dpady}`;
        document.getElementById('infoDpad').textContent = dpadText;
        document.getElementById('infoDpadBottom').textContent = dpadText;
    }
}

// Initialize controller when page loads
window.addEventListener('DOMContentLoaded', () => {
    const gamepadMapper = new GamepadMapper();
    const bluetoothService = new BluetoothService();
    const uiController = new UIController(gamepadMapper, bluetoothService);
});
