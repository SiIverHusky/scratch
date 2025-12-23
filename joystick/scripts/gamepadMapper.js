// Gamepad Mapper
// Maps UI inputs to DualShock 4 controller state

class GamepadMapper {
    constructor() {
        this.state = {
            lx: 0.0,  // Left stick X
            ly: 0.0,  // Left stick Y
            rx: 0.0,  // Right stick X
            ry: 0.0,  // Right stick Y
            dpadx: 0, // D-pad X
            dpady: 0, // D-pad Y
            R1: 0,
            message_rate: 50
        };
        
        // Future features: x (hop), circle (dance), triangle (shutdown)
    }

    // Left joystick methods
    setLeftStick(x, y) {
        this.state.lx = x;
        this.state.ly = y;
    }

    resetLeftStick() {
        this.state.lx = 0;
        this.state.ly = 0;
    }

    // Right joystick methods
    setRightStick(x, y) {
        this.state.rx = x;
        this.state.ry = y;
    }

    resetRightStick() {
        this.state.rx = 0;
        this.state.ry = 0;
    }

    // D-pad methods
    setDpadUp(active) {
        this.state.dpady = active ? 1 : 0;
    }

    setDpadDown(active) {
        this.state.dpady = active ? -1 : 0;
    }

    setDpadLeft(active) {
        this.state.dpadx = active ? -1 : 0;
    }

    setDpadRight(active) {
        this.state.dpadx = active ? 1 : 0;
    }

    resetDpad() {
        this.state.dpadx = 0;
        this.state.dpady = 0;
    }

    // Button methods
    setButton(button, value) {
        this.state[button] = value;
    }

    // Get current state
    getState() {
        return { ...this.state };
    }
}
