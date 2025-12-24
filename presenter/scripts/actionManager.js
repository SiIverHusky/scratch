// Action Manager for Presenter
// Manages customizable action buttons with MCP instructions
// Actions are stored in localStorage for persistence

class ActionManager {
    constructor() {
        this.actions = [];
        this.storageKey = 'presenter_actions';
        this.onActionsChange = null;
        this.loadActions();
    }

    /**
     * Load actions from localStorage
     */
    loadActions() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.actions = JSON.parse(saved);
                console.log(`Loaded ${this.actions.length} actions from storage`);
            } else {
                // Start with empty actions - user will create based on available tools
                this.actions = [];
            }
        } catch (error) {
            console.error('Failed to load actions:', error);
            this.actions = [];
        }
    }

    /**
     * Save actions to localStorage
     */
    saveActions() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.actions));
            console.log(`Saved ${this.actions.length} actions to storage`);
            
            if (this.onActionsChange) {
                this.onActionsChange();
            }
        } catch (error) {
            console.error('Failed to save actions:', error);
        }
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return 'action_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all actions
     */
    getActions() {
        return this.actions;
    }

    /**
     * Get a specific action by ID
     */
    getAction(actionId) {
        return this.actions.find(a => a.id === actionId);
    }

    /**
     * Create a new action
     * @param {object} actionData - Action configuration
     * @param {string} actionData.name - Display name
     * @param {string} actionData.icon - Emoji icon
     * @param {string} actionData.color - Button color
     * @param {Array} actionData.instructions - Array of MCP tool call instructions
     */
    createAction(actionData) {
        const action = {
            id: this.generateId(),
            name: actionData.name || 'New Action',
            icon: actionData.icon || '🎬',
            color: actionData.color || '#667eea',
            instructions: actionData.instructions || []
        };

        this.actions.push(action);
        this.saveActions();
        return action;
    }

    /**
     * Update an existing action
     */
    updateAction(actionId, actionData) {
        const index = this.actions.findIndex(a => a.id === actionId);
        if (index !== -1) {
            this.actions[index] = {
                ...this.actions[index],
                ...actionData,
                id: actionId // Preserve the ID
            };
            this.saveActions();
            return this.actions[index];
        }
        return null;
    }

    /**
     * Delete an action
     */
    deleteAction(actionId) {
        const index = this.actions.findIndex(a => a.id === actionId);
        if (index !== -1) {
            this.actions.splice(index, 1);
            this.saveActions();
            return true;
        }
        return false;
    }

    /**
     * Reorder actions (for drag and drop)
     */
    reorderActions(fromIndex, toIndex) {
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.actions.length || toIndex >= this.actions.length) {
            return false;
        }

        const [action] = this.actions.splice(fromIndex, 1);
        this.actions.splice(toIndex, 0, action);
        this.saveActions();
        return true;
    }

    /**
     * Export all actions as JSON string
     */
    exportActions() {
        return JSON.stringify(this.actions, null, 2);
    }

    /**
     * Import actions from JSON string
     * @param {string} jsonString - The JSON string to import
     * @param {boolean} replace - If true, replace all actions; if false, merge
     */
    importActions(jsonString, replace = false) {
        try {
            const imported = JSON.parse(jsonString);
            
            if (!Array.isArray(imported)) {
                throw new Error('Invalid format: expected an array');
            }

            // Validate and clean imported actions
            const validActions = imported.map(action => ({
                id: action.id || this.generateId(),
                name: action.name || 'Imported Action',
                icon: action.icon || '🎬',
                color: action.color || '#667eea',
                instructions: Array.isArray(action.instructions) ? action.instructions.map(inst => ({
                    tool: inst.tool || '',
                    arguments: inst.arguments || {},
                    delay: inst.delay || 0
                })) : []
            }));

            if (replace) {
                this.actions = validActions;
            } else {
                // Merge: add only actions with unique IDs
                const existingIds = new Set(this.actions.map(a => a.id));
                for (const action of validActions) {
                    if (!existingIds.has(action.id)) {
                        action.id = this.generateId(); // Assign new ID to avoid conflicts
                        this.actions.push(action);
                    }
                }
            }

            this.saveActions();
            return { success: true, count: validActions.length };
        } catch (error) {
            console.error('Import failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all actions
     */
    clearActions() {
        this.actions = [];
        this.saveActions();
    }

    /**
     * Create an instruction object for an action
     * @param {string} toolName - The MCP tool name
     * @param {object} args - The tool arguments (from inputSchema)
     * @param {number} delay - Delay after execution in ms
     */
    createInstruction(toolName, args = {}, delay = 500) {
        return {
            tool: toolName,
            arguments: args,
            delay: delay
        };
    }

    /**
     * Validate an instruction against available tools
     * @param {object} instruction - The instruction to validate
     * @param {Array} availableTools - List of available MCP tools
     */
    validateInstruction(instruction, availableTools = []) {
        const errors = [];

        if (!instruction.tool || typeof instruction.tool !== 'string') {
            errors.push('Tool name is required');
        } else if (availableTools.length > 0) {
            // Check if tool exists in available tools
            const tool = availableTools.find(t => t.name === instruction.tool);
            if (!tool) {
                errors.push(`Tool '${instruction.tool}' not found in available tools`);
            }
        }

        if (instruction.arguments && typeof instruction.arguments !== 'object') {
            errors.push('Arguments must be an object');
        }

        if (instruction.delay !== undefined && (typeof instruction.delay !== 'number' || instruction.delay < 0)) {
            errors.push('Delay must be a non-negative number');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate an action
     * @param {object} action - The action to validate
     * @param {Array} availableTools - List of available MCP tools
     */
    validateAction(action, availableTools = []) {
        const errors = [];

        if (!action.name || action.name.trim() === '') {
            errors.push('Action name is required');
        }

        if (!action.instructions || action.instructions.length === 0) {
            errors.push('At least one instruction is required');
        } else {
            action.instructions.forEach((inst, index) => {
                const result = this.validateInstruction(inst, availableTools);
                if (!result.valid) {
                    errors.push(`Instruction ${index + 1}: ${result.errors.join(', ')}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Create a sample action from an MCP tool
     * Useful for quickly creating actions from discovered tools
     * @param {object} tool - MCP tool definition
     */
    createActionFromTool(tool) {
        // Build default arguments from schema
        const defaultArgs = {};
        if (tool.inputSchema && tool.inputSchema.properties) {
            for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
                if (prop.default !== undefined) {
                    defaultArgs[key] = prop.default;
                } else if (prop.enum && prop.enum.length > 0) {
                    defaultArgs[key] = prop.enum[0];
                } else if (prop.type === 'number' || prop.type === 'integer') {
                    defaultArgs[key] = prop.minimum || 0;
                } else if (prop.type === 'boolean') {
                    defaultArgs[key] = false;
                } else if (prop.type === 'string') {
                    defaultArgs[key] = '';
                }
            }
        }

        return this.createAction({
            name: tool.name,
            icon: '🔧',
            color: '#667eea',
            instructions: [{
                tool: tool.name,
                arguments: defaultArgs,
                delay: 500
            }]
        });
    }
}

// Export as singleton
window.actionManager = new ActionManager();
