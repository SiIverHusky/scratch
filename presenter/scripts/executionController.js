// Execution Controller for Presenter
// Handles running action instructions with run-once and continuous loop modes
// Uses proper MCP tools/call protocol

class ExecutionController {
    constructor(bluetoothService, actionManager) {
        this.bluetoothService = bluetoothService;
        this.actionManager = actionManager;
        
        // Execution state
        this.isRunning = false;
        this.shouldStop = false; // Flag to stop at end of instruction list
        this.currentAction = null;
        this.currentInstructionIndex = 0;
        this.loopCount = 0;
        this.runMode = 'once'; // 'once' or 'loop'
        
        // Callbacks
        this.onStatusChange = null;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Run an action once
     * @param {string} actionId - The action ID to run
     */
    async runOnce(actionId) {
        const action = this.actionManager.getAction(actionId);
        if (!action) {
            this.notifyError('Action not found');
            return false;
        }

        if (this.isRunning) {
            this.notifyError('Another action is already running');
            return false;
        }

        if (this.bluetoothService.getConnectedCount() === 0) {
            this.notifyError('No robots connected');
            return false;
        }

        this.runMode = 'once';
        this.currentAction = action;
        this.loopCount = 1;
        this.shouldStop = false;
        
        // Send Wake Up to alert robots that a program is starting
        await this.sendStartSignal();
        
        const result = await this.executeAction();
        
        // Send Quit to reset robots after run once completes
        await this.sendStopSignal();
        
        return result;
    }

    /**
     * Run an action in continuous loop until stopped
     * @param {string} actionId - The action ID to run
     */
    async runLoop(actionId) {
        const action = this.actionManager.getAction(actionId);
        if (!action) {
            this.notifyError('Action not found');
            return false;
        }

        if (this.isRunning) {
            this.notifyError('Another action is already running');
            return false;
        }

        if (this.bluetoothService.getConnectedCount() === 0) {
            this.notifyError('No robots connected');
            return false;
        }

        this.runMode = 'loop';
        this.currentAction = action;
        this.loopCount = 0;
        this.shouldStop = false;
        
        // Send Wake Up to alert robots that a program is starting
        await this.sendStartSignal();
        
        const result = await this.executeAction();
        
        // Send Quit when loop is stopped to reset robots
        await this.sendStopSignal();
        
        return result;
    }

    /**
     * Request to stop execution at the end of current instruction list
     */
    requestStop() {
        if (this.isRunning) {
            this.shouldStop = true;
            this.notifyStatus('stopping', 'Stopping at end of cycle...');
            console.log('Stop requested - will stop at end of instruction list');
        }
    }

    /**
     * Force immediate stop (not recommended for smooth operation)
     * Also sends quit signal to reset robots
     */
    async forceStop() {
        this.shouldStop = true;
        this.isRunning = false;
        
        // Send quit to reset robots even on force stop
        await this.sendStopSignal();
        
        this.notifyStatus('stopped', 'Stopped');
        this.notifyComplete(false, 'Force stopped');
    }

    /**
     * Execute the current action
     */
    async executeAction() {
        if (!this.currentAction) {
            return false;
        }

        this.isRunning = true;
        this.notifyStatus('running', `Running: ${this.currentAction.name}`);

        try {
            do {
                this.loopCount++;
                console.log(`Starting loop ${this.loopCount} for action: ${this.currentAction.name}`);
                
                // Execute all instructions in sequence
                for (let i = 0; i < this.currentAction.instructions.length; i++) {
                    // Check if we should stop before each instruction
                    if (!this.isRunning) {
                        break;
                    }

                    this.currentInstructionIndex = i;
                    const instruction = this.currentAction.instructions[i];
                    
                    this.notifyProgress(i + 1, this.currentAction.instructions.length, instruction.tool);
                    
                    // Execute the instruction via MCP tools/call
                    await this.executeInstruction(instruction);
                    
                    // Wait for the delay
                    if (instruction.delay && instruction.delay > 0) {
                        await this.delay(instruction.delay);
                    }
                }

                // Check if we should continue looping
                if (this.runMode === 'loop' && !this.shouldStop && this.isRunning) {
                    console.log(`Completed loop ${this.loopCount}, continuing...`);
                    // Small pause between loops
                    await this.delay(100);
                }
                
            } while (this.runMode === 'loop' && !this.shouldStop && this.isRunning);

            // Execution completed
            this.isRunning = false;
            this.notifyStatus('completed', 'Completed');
            this.notifyComplete(true, this.runMode === 'loop' ? 
                `Completed ${this.loopCount} loops` : 'Completed');
            
            return true;

        } catch (error) {
            console.error('Execution error:', error);
            this.isRunning = false;
            this.notifyStatus('error', 'Error occurred');
            this.notifyError(error.message);
            return false;
        }
    }

    /**
     * Execute a single instruction using MCP tools/call
     * @param {object} instruction - The instruction to execute
     */
    async executeInstruction(instruction) {
        console.log(`Executing MCP tool: ${instruction.tool}`, instruction.arguments);

        // Send the MCP tools/call to all connected robots
        const results = await this.bluetoothService.executeToolOnAll(
            instruction.tool,
            instruction.arguments || {}
        );

        // Log results
        for (const result of results) {
            if (result.success) {
                console.log(`✓ ${result.robotName}: tool call sent`);
            } else {
                console.warn(`✗ ${result.robotName}: ${result.error}`);
            }
        }

        return results;
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to wait
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send start signal (Wake Up) to all robots
     * Alerts robots that a new program sequence is starting
     */
    async sendStartSignal() {
        console.log('📢 Sending start signal (Wake Up)...');
        this.notifyStatus('starting', 'Waking up robots...');
        
        try {
            await this.bluetoothService.sendWakeUp();
            // Small delay to let robots process the wake up
            await this.delay(300);
        } catch (error) {
            console.warn('Failed to send start signal:', error);
        }
    }

    /**
     * Send stop signal (quit) to all robots
     * Resets robots to neutral/rest position
     */
    async sendStopSignal() {
        console.log('🛑 Sending stop signal (quit)...');
        this.notifyStatus('resetting', 'Resetting robots...');
        
        try {
            await this.bluetoothService.sendQuit();
            // Small delay to let robots process the quit command
            await this.delay(500);
        } catch (error) {
            console.warn('Failed to send stop signal:', error);
        }
    }

    /**
     * Get current execution state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            shouldStop: this.shouldStop,
            currentAction: this.currentAction,
            currentInstructionIndex: this.currentInstructionIndex,
            loopCount: this.loopCount,
            runMode: this.runMode
        };
    }

    /**
     * Notify status change
     */
    notifyStatus(status, message) {
        if (this.onStatusChange) {
            this.onStatusChange(status, message);
        }
    }

    /**
     * Notify progress
     */
    notifyProgress(current, total, toolName) {
        if (this.onProgress) {
            this.onProgress(current, total, toolName, this.loopCount);
        }
    }

    /**
     * Notify completion
     */
    notifyComplete(success, message) {
        if (this.onComplete) {
            this.onComplete(success, message);
        }
    }

    /**
     * Notify error
     */
    notifyError(message) {
        if (this.onError) {
            this.onError(message);
        }
    }
}

// Export as singleton (will be initialized in main.js)
window.ExecutionController = ExecutionController;
