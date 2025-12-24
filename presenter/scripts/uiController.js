// UI Controller for Presenter
// Handles all UI interactions and updates
// Supports MCP tool selection with parameter configuration from inputSchema

class UIController {
    constructor(bluetoothService, actionManager, executionController) {
        this.bluetoothService = bluetoothService;
        this.actionManager = actionManager;
        this.executionController = executionController;

        // UI state
        this.editingActionId = null;
        this.editingInstructionIndex = null;
        this.tempInstructions = [];
        this.selectedRobotId = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCallbacks();
        this.renderRobotsList();
        this.renderActionsGrid();
        this.renderToolsStatus();
    }

    setupCallbacks() {
        // Bluetooth callbacks
        this.bluetoothService.onRobotsChange = () => {
            this.renderRobotsList();
            this.updateDisconnectAllButton();
        };

        // Tools received callback
        this.bluetoothService.onToolsReceived = (tools) => {
            this.showToast(`Loaded ${tools.length} MCP tools`, 'success');
            this.renderToolsStatus();
        };

        // Action manager callbacks
        this.actionManager.onActionsChange = () => {
            this.renderActionsGrid();
        };

        // Execution controller callbacks
        this.executionController.onStatusChange = (status, message) => {
            this.updateExecutionStatus(status, message);
        };

        this.executionController.onProgress = (current, total, toolName, loopCount) => {
            this.updateExecutionProgress(current, total, toolName, loopCount);
        };

        this.executionController.onComplete = (success, message) => {
            this.handleExecutionComplete(success, message);
        };

        this.executionController.onError = (message) => {
            this.showToast(message, 'error');
        };
    }

    setupEventListeners() {
        // Robot management
        document.getElementById('connectBtn').addEventListener('click', () => this.handleConnect());
        document.getElementById('disconnectAllBtn').addEventListener('click', () => this.handleDisconnectAll());

        // Action management
        document.getElementById('addActionBtn').addEventListener('click', () => this.openEditActionModal());
        document.getElementById('importExportBtn').addEventListener('click', () => this.openImportExportModal());

        // Execution
        document.getElementById('stopExecutionBtn').addEventListener('click', () => this.handleStopExecution());

        // Edit Action Modal
        document.getElementById('editModalClose').addEventListener('click', () => this.closeEditActionModal());
        document.getElementById('cancelActionBtn').addEventListener('click', () => this.closeEditActionModal());
        document.getElementById('saveActionBtn').addEventListener('click', () => this.saveAction());
        document.getElementById('deleteActionBtn').addEventListener('click', () => this.deleteAction());
        document.getElementById('addInstructionBtn').addEventListener('click', () => this.openInstructionModal());

        // Color presets
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('actionColor').value = e.target.dataset.color;
            });
        });

        // Instruction Modal
        document.getElementById('instructionModalClose').addEventListener('click', () => this.closeInstructionModal());
        document.getElementById('cancelInstructionBtn').addEventListener('click', () => this.closeInstructionModal());
        document.getElementById('saveInstructionBtn').addEventListener('click', () => this.saveInstruction());

        // Tool selection change - update parameters form
        document.getElementById('instructionTool').addEventListener('change', (e) => {
            this.renderToolParametersForm(e.target.value);
        });

        // Run Mode Modal
        document.getElementById('runModeModalClose').addEventListener('click', () => this.closeRunModeModal());
        document.getElementById('runOnceBtn').addEventListener('click', () => this.runAction('once'));
        document.getElementById('runLoopBtn').addEventListener('click', () => this.runAction('loop'));

        // Import/Export Modal
        document.getElementById('importExportModalClose').addEventListener('click', () => this.closeImportExportModal());
        document.getElementById('copyExportBtn').addEventListener('click', () => this.copyExport());
        document.getElementById('doImportBtn').addEventListener('click', () => this.doImport());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Manage Robot Modal
        document.getElementById('manageRobotModalClose').addEventListener('click', () => this.closeManageRobotModal());
        document.getElementById('closeManageRobotBtn').addEventListener('click', () => this.closeManageRobotModal());
        document.getElementById('disconnectRobotBtn').addEventListener('click', () => this.disconnectSelectedRobot());

        // Tools List Modal
        document.getElementById('toolsListModalClose').addEventListener('click', () => this.closeToolsListModal());
        document.getElementById('refreshToolsBtn').addEventListener('click', () => this.handleRefreshTools());

        // Tools status bar click
        document.getElementById('toolsStatus').addEventListener('click', () => this.openToolsListModal());

        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    // ==================== Robot Management ====================

    async handleConnect() {
        const btn = document.getElementById('connectBtn');
        btn.disabled = true;
        btn.textContent = 'Connecting...';

        try {
            const robot = await this.bluetoothService.connect();
            this.showToast(`Connected to ${robot.name}`, 'success');
        } catch (error) {
            if (error.name !== 'NotFoundError') {
                this.showToast(`Connection failed: ${error.message}`, 'error');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = '+ Add Robot';
        }
    }

    handleDisconnectAll() {
        if (this.bluetoothService.getConnectedCount() > 0) {
            this.bluetoothService.disconnectAll();
            this.showToast('All robots disconnected', 'info');
        }
    }

    updateDisconnectAllButton() {
        const btn = document.getElementById('disconnectAllBtn');
        btn.disabled = this.bluetoothService.getConnectedCount() === 0;
    }

    renderRobotsList() {
        const container = document.getElementById('robotsList');
        const countEl = document.getElementById('robotCount');
        const robots = this.bluetoothService.getRobots();

        countEl.textContent = robots.length;

        if (robots.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🐕</div>
                    <p>No robots connected</p>
                    <p class="hint">Click "Add Robot" to connect a MiniPupper</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        robots.forEach(robot => {
            const item = document.createElement('div');
            item.className = 'robot-item';
            item.innerHTML = `
                <div class="robot-icon">🐕</div>
                <div class="robot-info">
                    <div class="robot-name">${robot.name}</div>
                    <div class="robot-time">Connected ${this.getTimeSince(robot.connectedAt)}</div>
                </div>
                <button class="robot-manage-btn" data-robot-id="${robot.id}">⚙️</button>
            `;

            item.querySelector('.robot-manage-btn').addEventListener('click', () => {
                this.openManageRobotModal(robot.id);
            });

            container.appendChild(item);
        });
        
        // Update tools status
        this.renderToolsStatus();
    }

    /**
     * Render MCP tools status indicator
     */
    renderToolsStatus() {
        const container = document.getElementById('toolsStatus');
        if (!container) return;
        
        const tools = this.bluetoothService.getAvailableTools();
        const isLoaded = this.bluetoothService.isToolsLoaded();
        
        if (tools.length === 0) {
            container.innerHTML = `
                <div class="tools-status-empty">
                    <span class="tools-icon">🔧</span>
                    <span>No MCP tools loaded</span>
                    <button class="btn btn-small btn-secondary" id="refreshToolsBtn">Refresh</button>
                </div>
            `;
            const refreshBtn = container.querySelector('#refreshToolsBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.handleRefreshTools());
            }
        } else {
            const cacheIndicator = isLoaded ? '' : ' (cached)';
            container.innerHTML = `
                <div class="tools-status-loaded">
                    <span class="tools-icon">✅</span>
                    <span>${tools.length} MCP tools available${cacheIndicator}</span>
                    <button class="btn btn-small btn-secondary" id="refreshToolsBtn">↻</button>
                    <button class="btn btn-small btn-secondary" id="viewToolsBtn">View</button>
                </div>
            `;
            const refreshBtn = container.querySelector('#refreshToolsBtn');
            const viewBtn = container.querySelector('#viewToolsBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.handleRefreshTools());
            }
            if (viewBtn) {
                viewBtn.addEventListener('click', () => this.openToolsListModal());
            }
        }
    }

    async handleRefreshTools() {
        if (this.bluetoothService.getConnectedCount() === 0) {
            this.showToast('Connect a robot first to load tools', 'error');
            return;
        }
        
        this.showToast('Refreshing MCP tools...', 'info');
        await this.bluetoothService.refreshTools();
    }

    /**
     * Open modal showing all available tools
     */
    openToolsListModal() {
        const tools = this.bluetoothService.getAvailableTools();
        const modal = document.getElementById('toolsListModal');
        const container = document.getElementById('toolsGrid');
        const countEl = document.getElementById('toolsCount');
        
        if (!modal || !container) return;
        
        // Update count
        if (countEl) {
            countEl.textContent = `${tools.length} tool${tools.length !== 1 ? 's' : ''} available`;
        }
        
        if (tools.length === 0) {
            container.innerHTML = `
                <div class="tools-empty-state">
                    <div class="empty-icon">🔧</div>
                    <p>No tools loaded yet</p>
                    <p class="hint">Connect a robot to load available MCP tools</p>
                </div>
            `;
        } else {
            let html = '';
            tools.forEach(tool => {
                const params = this.bluetoothService.getToolParameters(tool.name);
                const paramCount = params.length;
                
                html += `
                    <div class="tool-card">
                        <div class="tool-card-header">
                            <div class="tool-name">${tool.name}</div>
                            <span class="tool-param-count">${paramCount} param${paramCount !== 1 ? 's' : ''}</span>
                        </div>
                        <p class="tool-description">${tool.description || 'No description available'}</p>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        modal.classList.add('show');
    }

    closeToolsListModal() {
        document.getElementById('toolsListModal').classList.remove('show');
    }

    openManageRobotModal(robotId) {
        const robot = this.bluetoothService.getRobot(robotId);
        if (!robot) return;

        this.selectedRobotId = robotId;
        document.getElementById('robotNameLarge').textContent = robot.name;
        document.getElementById('robotConnectedTime').textContent = this.getTimeSince(robot.connectedAt);
        document.getElementById('manageRobotModal').classList.add('show');
    }

    closeManageRobotModal() {
        document.getElementById('manageRobotModal').classList.remove('show');
        this.selectedRobotId = null;
    }

    disconnectSelectedRobot() {
        if (this.selectedRobotId) {
            const robot = this.bluetoothService.getRobot(this.selectedRobotId);
            const name = robot ? robot.name : 'Robot';
            this.bluetoothService.disconnect(this.selectedRobotId);
            this.closeManageRobotModal();
            this.showToast(`${name} disconnected`, 'info');
        }
    }

    // ==================== Action Management ====================

    renderActionsGrid() {
        const container = document.getElementById('actionsGrid');
        const actions = this.actionManager.getActions();

        if (actions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚡</div>
                    <p>No actions configured</p>
                    <p class="hint">Click "New Action" to create your first action button</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        actions.forEach(action => {
            const btn = document.createElement('div');
            btn.className = 'action-button';
            btn.style.backgroundColor = action.color;
            btn.innerHTML = `
                <div class="action-icon">${action.icon}</div>
                <div class="action-name">${action.name}</div>
                <div class="action-count">${action.instructions.length} instruction${action.instructions.length !== 1 ? 's' : ''}</div>
                <button class="action-edit-btn" data-action-id="${action.id}">✏️</button>
            `;

            // Click on action button to run
            btn.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-edit-btn')) {
                    this.openRunModeModal(action.id);
                }
            });

            // Edit button
            btn.querySelector('.action-edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditActionModal(action.id);
            });

            container.appendChild(btn);
        });
    }

    openEditActionModal(actionId = null) {
        this.editingActionId = actionId;
        
        const modal = document.getElementById('editActionModal');
        const title = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteActionBtn');
        
        if (actionId) {
            const action = this.actionManager.getAction(actionId);
            if (!action) return;

            title.textContent = 'Edit Action';
            document.getElementById('actionName').value = action.name;
            document.getElementById('actionIcon').value = action.icon;
            document.getElementById('actionColor').value = action.color;
            this.tempInstructions = [...action.instructions];
            deleteBtn.style.display = 'block';
        } else {
            title.textContent = 'New Action';
            document.getElementById('actionName').value = '';
            document.getElementById('actionIcon').value = '🎬';
            document.getElementById('actionColor').value = '#667eea';
            this.tempInstructions = [];
            deleteBtn.style.display = 'none';
        }

        this.renderInstructionsList();
        modal.classList.add('show');
    }

    closeEditActionModal() {
        document.getElementById('editActionModal').classList.remove('show');
        this.editingActionId = null;
        this.tempInstructions = [];
    }

    saveAction() {
        const name = document.getElementById('actionName').value.trim();
        const icon = document.getElementById('actionIcon').value || '🎬';
        const color = document.getElementById('actionColor').value;

        if (!name) {
            this.showToast('Action name is required', 'error');
            return;
        }

        if (this.tempInstructions.length === 0) {
            this.showToast('At least one instruction is required', 'error');
            return;
        }

        const actionData = {
            name,
            icon,
            color,
            instructions: this.tempInstructions
        };

        if (this.editingActionId) {
            this.actionManager.updateAction(this.editingActionId, actionData);
            this.showToast('Action updated', 'success');
        } else {
            this.actionManager.createAction(actionData);
            this.showToast('Action created', 'success');
        }

        this.closeEditActionModal();
    }

    deleteAction() {
        if (this.editingActionId) {
            if (confirm('Are you sure you want to delete this action?')) {
                this.actionManager.deleteAction(this.editingActionId);
                this.showToast('Action deleted', 'info');
                this.closeEditActionModal();
            }
        }
    }

    // ==================== Instructions Management ====================

    renderInstructionsList() {
        const container = document.getElementById('instructionsList');
        
        if (this.tempInstructions.length === 0) {
            container.innerHTML = `
                <div class="empty-instructions">
                    No instructions yet. Add your first instruction.
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.tempInstructions.forEach((inst, index) => {
            const item = document.createElement('div');
            item.className = 'instruction-item';
            
            // Format arguments for display
            const argsDisplay = inst.arguments && Object.keys(inst.arguments).length > 0 
                ? JSON.stringify(inst.arguments) 
                : '(no args)';
            
            item.innerHTML = `
                <div class="instruction-number">${index + 1}</div>
                <div class="instruction-content">
                    <div class="instruction-tool">${inst.tool || '(no tool)'}</div>
                    <div class="instruction-params">${argsDisplay}</div>
                    <div class="instruction-delay">Delay: ${inst.delay || 0}ms</div>
                </div>
                <div class="instruction-actions">
                    <button class="inst-btn inst-edit" data-index="${index}">✏️</button>
                    <button class="inst-btn inst-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="inst-btn inst-down" data-index="${index}" ${index === this.tempInstructions.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="inst-btn inst-delete" data-index="${index}">🗑️</button>
                </div>
            `;

            // Edit instruction
            item.querySelector('.inst-edit').addEventListener('click', () => {
                this.openInstructionModal(index);
            });

            // Move up
            item.querySelector('.inst-up').addEventListener('click', () => {
                if (index > 0) {
                    [this.tempInstructions[index], this.tempInstructions[index - 1]] = 
                    [this.tempInstructions[index - 1], this.tempInstructions[index]];
                    this.renderInstructionsList();
                }
            });

            // Move down
            item.querySelector('.inst-down').addEventListener('click', () => {
                if (index < this.tempInstructions.length - 1) {
                    [this.tempInstructions[index], this.tempInstructions[index + 1]] = 
                    [this.tempInstructions[index + 1], this.tempInstructions[index]];
                    this.renderInstructionsList();
                }
            });

            // Delete
            item.querySelector('.inst-delete').addEventListener('click', () => {
                this.tempInstructions.splice(index, 1);
                this.renderInstructionsList();
            });

            container.appendChild(item);
        });
    }

    openInstructionModal(index = null) {
        this.editingInstructionIndex = index;
        
        // Render tool dropdown with available MCP tools
        this.renderToolDropdown();
        
        if (index !== null && this.tempInstructions[index]) {
            const inst = this.tempInstructions[index];
            document.getElementById('instructionTool').value = inst.tool || '';
            document.getElementById('instructionDelay').value = inst.delay || 0;
            
            // Render parameter form for selected tool with existing values
            this.renderToolParametersForm(inst.tool, inst.arguments);
        } else {
            document.getElementById('instructionTool').value = '';
            document.getElementById('instructionDelay').value = 500;
            this.renderToolParametersForm('');
        }

        document.getElementById('instructionModal').classList.add('show');
    }

    /**
     * Render dropdown with available MCP tools
     */
    renderToolDropdown() {
        const select = document.getElementById('instructionTool');
        const tools = this.bluetoothService.getAvailableTools();
        
        // Clear existing options
        select.innerHTML = '<option value="">-- Select a tool --</option>';
        
        if (tools.length === 0) {
            select.innerHTML += '<option value="" disabled>(No tools loaded - connect a robot first)</option>';
            return;
        }
        
        // Group tools by category if they have a pattern like category_action
        const grouped = {};
        tools.forEach(tool => {
            const parts = tool.name.split('_');
            const category = parts.length > 1 ? parts[0] : 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(tool);
        });
        
        // Render grouped options
        for (const [category, categoryTools] of Object.entries(grouped)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);
            
            categoryTools.forEach(tool => {
                const option = document.createElement('option');
                option.value = tool.name;
                option.textContent = tool.name;
                if (tool.description) {
                    option.title = tool.description;
                }
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        }
    }

    /**
     * Render parameter form based on tool's inputSchema
     */
    renderToolParametersForm(toolName, existingValues = {}) {
        const container = document.getElementById('toolParamsContainer');
        const descEl = document.getElementById('toolDescription');
        
        if (!toolName) {
            container.innerHTML = `
                <div class="params-placeholder">
                    <span class="params-icon">⚙️</span>
                    <span>Select a tool above to configure its parameters</span>
                </div>
            `;
            if (descEl) descEl.textContent = 'Select a tool to see its description and parameters';
            return;
        }
        
        const tool = this.bluetoothService.getTool(toolName);
        if (!tool) {
            container.innerHTML = `
                <div class="params-placeholder">
                    <span class="params-icon">⚠️</span>
                    <span>Tool not found in available tools</span>
                </div>
            `;
            if (descEl) descEl.textContent = '';
            return;
        }
        
        // Update tool description
        if (descEl) {
            descEl.textContent = tool.description || 'No description available';
        }
        
        const params = this.bluetoothService.getToolParameters(toolName);
        
        if (params.length === 0) {
            container.innerHTML = `
                <div class="no-params-message">
                    <span>✓</span> This tool has no configurable parameters
                </div>
            `;
            return;
        }
        
        // Build parameter form
        let html = '<div class="tool-params-form"><h4>Parameters</h4>';
        params.forEach(param => {
            const value = existingValues[param.name] !== undefined 
                ? existingValues[param.name] 
                : (param.default !== undefined ? param.default : '');
            
            const requiredMark = param.required ? '<span class="required">*</span>' : '';
            const description = param.description ? `<p class="param-hint">${param.description}</p>` : '';
            
            html += `<div class="param-group">`;
            html += `<label for="param_${param.name}">${param.name}${requiredMark}</label>`;
            
            if (param.enum && param.enum.length > 0) {
                // Enum - render as dropdown
                html += `<select id="param_${param.name}" class="tool-param" data-param="${param.name}" data-type="${param.type}">`;
                param.enum.forEach(opt => {
                    const selected = value === opt ? 'selected' : '';
                    html += `<option value="${opt}" ${selected}>${opt}</option>`;
                });
                html += `</select>`;
            } else if (param.type === 'boolean') {
                // Boolean - render as checkbox
                const checked = value === true || value === 'true' ? 'checked' : '';
                html += `<label class="checkbox-label">`;
                html += `<input type="checkbox" id="param_${param.name}" class="tool-param" data-param="${param.name}" data-type="boolean" ${checked}>`;
                html += `<span>Enable</span></label>`;
            } else if (param.type === 'number' || param.type === 'integer') {
                // Number - render with min/max if available
                const min = param.minimum !== undefined ? `min="${param.minimum}"` : '';
                const max = param.maximum !== undefined ? `max="${param.maximum}"` : '';
                const step = param.type === 'integer' ? 'step="1"' : 'step="any"';
                html += `<input type="number" id="param_${param.name}" class="tool-param" data-param="${param.name}" data-type="${param.type}" value="${value}" ${min} ${max} ${step}>`;
            } else {
                // String or other - render as text input
                html += `<input type="text" id="param_${param.name}" class="tool-param" data-param="${param.name}" data-type="string" value="${value}">`;
            }
            
            html += description;
            html += `</div>`;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }

    /**
     * Collect parameter values from the form
     */
    collectToolParameters() {
        const params = {};
        const inputs = document.querySelectorAll('.tool-param');
        
        inputs.forEach(input => {
            const paramName = input.dataset.param;
            const paramType = input.dataset.type;
            let value;
            
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (paramType === 'number' || paramType === 'integer') {
                value = input.value !== '' ? Number(input.value) : undefined;
            } else if (paramType === 'boolean') {
                value = input.value === 'true';
            } else {
                value = input.value;
            }
            
            // Only include if value is set
            if (value !== undefined && value !== '') {
                params[paramName] = value;
            }
        });
        
        return params;
    }

    closeInstructionModal() {
        document.getElementById('instructionModal').classList.remove('show');
        this.editingInstructionIndex = null;
    }

    saveInstruction() {
        const tool = document.getElementById('instructionTool').value.trim();
        const delay = parseInt(document.getElementById('instructionDelay').value) || 0;

        if (!tool) {
            this.showToast('Please select a tool', 'error');
            return;
        }

        // Collect parameters from the form
        const args = this.collectToolParameters();

        const instruction = { 
            tool, 
            arguments: args, 
            delay 
        };

        if (this.editingInstructionIndex !== null) {
            this.tempInstructions[this.editingInstructionIndex] = instruction;
        } else {
            this.tempInstructions.push(instruction);
        }

        this.closeInstructionModal();
        this.renderInstructionsList();
    }

    // ==================== Run Mode ====================

    openRunModeModal(actionId) {
        const action = this.actionManager.getAction(actionId);
        if (!action) return;

        if (this.bluetoothService.getConnectedCount() === 0) {
            this.showToast('Connect at least one robot first', 'error');
            return;
        }

        this.pendingActionId = actionId;
        document.getElementById('runActionName').textContent = action.name;
        document.getElementById('runModeModal').classList.add('show');
    }

    closeRunModeModal() {
        document.getElementById('runModeModal').classList.remove('show');
        this.pendingActionId = null;
    }

    runAction(mode) {
        const actionId = this.pendingActionId;
        this.closeRunModeModal();

        if (!actionId) return;

        if (mode === 'once') {
            this.executionController.runOnce(actionId);
        } else {
            this.executionController.runLoop(actionId);
        }
    }

    // ==================== Execution Status ====================

    updateExecutionStatus(status, message) {
        const section = document.getElementById('statusSection');
        const indicator = document.getElementById('statusIndicator');
        const textEl = document.getElementById('statusText');

        section.style.display = 'block';
        textEl.textContent = message;

        // Update indicator style
        indicator.className = 'status-indicator status-' + status;

        // Update icon
        const iconEl = indicator.querySelector('.status-icon');
        switch (status) {
            case 'running':
                iconEl.textContent = '▶️';
                break;
            case 'stopping':
                iconEl.textContent = '⏸️';
                break;
            case 'completed':
                iconEl.textContent = '✅';
                break;
            case 'error':
                iconEl.textContent = '❌';
                break;
            default:
                iconEl.textContent = '▶️';
        }
    }

    updateExecutionProgress(current, total, toolName, loopCount) {
        document.getElementById('currentAction').textContent = 
            `Step ${current}/${total}: ${toolName}`;
        
        if (this.executionController.runMode === 'loop') {
            document.getElementById('loopCount').textContent = `Loop #${loopCount}`;
        } else {
            document.getElementById('loopCount').textContent = '';
        }
    }

    handleExecutionComplete(success, message) {
        this.showToast(message, success ? 'success' : 'info');
        
        // Hide status section after a delay
        setTimeout(() => {
            if (!this.executionController.isRunning) {
                document.getElementById('statusSection').style.display = 'none';
            }
        }, 3000);
    }

    handleStopExecution() {
        this.executionController.requestStop();
    }

    // ==================== Import/Export ====================

    openImportExportModal() {
        document.getElementById('exportData').value = this.actionManager.exportActions();
        document.getElementById('importData').value = '';
        this.switchTab('export');
        document.getElementById('importExportModal').classList.add('show');
    }

    closeImportExportModal() {
        document.getElementById('importExportModal').classList.remove('show');
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('exportTab').style.display = tab === 'export' ? 'block' : 'none';
        document.getElementById('importTab').style.display = tab === 'import' ? 'block' : 'none';
    }

    copyExport() {
        const textarea = document.getElementById('exportData');
        textarea.select();
        document.execCommand('copy');
        this.showToast('Copied to clipboard', 'success');
    }

    doImport() {
        const jsonStr = document.getElementById('importData').value.trim();
        if (!jsonStr) {
            this.showToast('Paste JSON data to import', 'error');
            return;
        }

        const result = this.actionManager.importActions(jsonStr, false);
        if (result.success) {
            this.showToast(`Imported ${result.count} actions`, 'success');
            this.closeImportExportModal();
        } else {
            this.showToast(`Import failed: ${result.error}`, 'error');
        }
    }

    // ==================== Utilities ====================

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

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export
window.UIController = UIController;
