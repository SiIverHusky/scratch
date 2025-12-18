// Code Generator for Blockly blocks
// Based on working v2 implementation - uses forBlock pattern and getParameterValues method

// Access the Python generator from the global Blockly object
const pythonGenerator = Blockly.Python;

// Python generators for custom blocks
pythonGenerator.forBlock['start_flag'] = function(block, generator) {
    return '# Program starts here\nsend_message(\'Wake Up\')\n';
};

pythonGenerator.forBlock['stop_flag'] = function(block, generator) {
    return '# Program ends here\nexecute_santa_command("self.system.quit", {})\n';
};

pythonGenerator.forBlock['send_msg'] = function(block, generator) {
    const text = generator.valueToCode(block, 'TEXT', pythonGenerator.ORDER_ATOMIC) || '""';
    return `send_message(${text})\n`;
};

pythonGenerator.forBlock['send_cmd_dropdown'] = function(block, generator) {
    const command = block.getFieldValue('CMD');
    if (!command || command === 'NONE') {
        return '# No command selected\n';
    }
    
    // Get parameter values using the method from v2
    let parameters = {};
    if (typeof block.getParameterValues === 'function') {
        parameters = block.getParameterValues();
    }
    
    // Generate parameter arguments in Python format
    const paramEntries = [];
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (typeof paramValue === 'string' && paramValue.startsWith('[[') && paramValue.endsWith(']]')) {
            // This is a placeholder for a connected block value
            const inputName = paramValue.slice(2, -2); // Remove [[ and ]]
            const connectedValue = generator.valueToCode(block, inputName, pythonGenerator.ORDER_ATOMIC) || 'None';
            paramEntries.push(`"${paramName}": ${connectedValue}`);
        } else {
            // Direct value (boolean, enum, etc.)
            let pythonValue;
            if (typeof paramValue === 'boolean') {
                pythonValue = paramValue ? 'True' : 'False';
            } else if (typeof paramValue === 'string') {
                pythonValue = `"${paramValue}"`;
            } else {
                pythonValue = String(paramValue);
            }
            paramEntries.push(`"${paramName}": ${pythonValue}`);
        }
    }
    
    // Build the function call with parameters as a dictionary
    const paramStr = paramEntries.length > 0 ? `{${paramEntries.join(', ')}}` : '{}';
    return `execute_santa_command("${command}", ${paramStr})\n`;
};

// Access the JavaScript generator from the global Blockly object
const javascriptGenerator = Blockly.JavaScript;

// Configure JavaScript generator for execution
javascriptGenerator.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
javascriptGenerator.addReservedWords('highlightBlock');
javascriptGenerator.addReservedWords('setVar');

window.LoopTrap = 1000;
javascriptGenerator.INFINITE_LOOP_TRAP = 'if(--window.LoopTrap == 0) throw "Infinite loop.";\n';

// JavaScript generators for custom blocks
javascriptGenerator.forBlock['start_flag'] = function(block, generator) {
    return '// Program starts here\nsend_msg(\'Wake Up\');\n';
};

javascriptGenerator.forBlock['stop_flag'] = function(block, generator) {
    return '// Program ends here\ncmd_dropdown("self.system.quit", {});\ninterpreter.stop();\n';
};

// Variable assignment with setVar tracking
javascriptGenerator.forBlock['variables_set'] = function(block, generator) {
    const variable = generator.getVariableName(block.getFieldValue('VAR'));
    const value = generator.valueToCode(block, 'VALUE', generator.ORDER_ASSIGNMENT) || '0';
    const blockId = block.id;
    
    // Generate the assignment and setVar call - setVar will look up the actual value
    const code = variable + ' = ' + value + ';\n' + 
                'setVar(\'' + blockId + '=' + variable + '\');\n';
    return code;
};

// Variable getter
javascriptGenerator.forBlock['variables_get'] = function(block, generator) {
    const variable = generator.getVariableName(block.getFieldValue('VAR'));
    return [variable, generator.ORDER_ATOMIC];
};

// JavaScript generators for Santa blocks (for browser execution) - V2 Compatible
javascriptGenerator.forBlock['send_msg'] = function(block, generator) {
    const text = generator.valueToCode(block, 'TEXT', javascriptGenerator.ORDER_ATOMIC) || '""';
    const code = `send_msg(${text});\n`;
    return code;
};

javascriptGenerator.forBlock['send_cmd_dropdown'] = function(block, generator) {
    const toolName = block.getFieldValue('CMD');
    
    // Get parameter values if the block has the method
    let parameters = {};
    if (typeof block.getParameterValues === 'function') {
        parameters = block.getParameterValues();
    }
    
    // Generate parameter object for JavaScript
    let paramCode = '{';
    const paramEntries = [];
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (typeof paramValue === 'string' && paramValue.startsWith('[[') && paramValue.endsWith(']]')) {
            // This is a placeholder for a connected block value
            const inputName = paramValue.slice(2, -2); // Remove [[ and ]]
            const connectedValue = generator.valueToCode(block, inputName, javascriptGenerator.ORDER_ATOMIC) || 'null';
            paramEntries.push(`${paramName}: ${connectedValue}`);
        } else {
            // Direct value (boolean, enum, etc.)
            const jsonValue = JSON.stringify(paramValue);
            paramEntries.push(`${paramName}: ${jsonValue}`);
        }
    }
    
    paramCode += paramEntries.join(', ') + '}';
    
    // For non-interpreter execution, use cmd_dropdown directly
    const code = `cmd_dropdown("${toolName}", ${paramCode});\n`;
    return code;
};

javascriptGenerator.forBlock['send_cmd_dropdown'] = function(block, generator) {
    const command = block.getFieldValue('CMD');
    if (!command || command === 'NONE') {
        return '// No command selected\n';
    }
    
    // Get parameter values using the method from v2
    let parameters = {};
    if (typeof block.getParameterValues === 'function') {
        parameters = block.getParameterValues();
    }
    
    // Generate parameter object for JavaScript
    let paramCode = '{';
    const paramEntries = [];
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (typeof paramValue === 'string' && paramValue.startsWith('[[') && paramValue.endsWith(']]')) {
            // This is a placeholder for a connected block value
            const inputName = paramValue.slice(2, -2); // Remove [[ and ]]
            const connectedValue = generator.valueToCode(block, inputName, javascriptGenerator.ORDER_ATOMIC) || 'null';
            paramEntries.push(`${paramName}: ${connectedValue}`);
        } else {
            // Direct value (boolean, enum, etc.)
            const jsonValue = JSON.stringify(paramValue);
            paramEntries.push(`${paramName}: ${jsonValue}`);
        }
    }
    
    paramCode += paramEntries.join(', ') + '}';
    
    return `cmd_dropdown("${command}", ${paramCode});\n`;
};

javascriptGenerator.forBlock['start_flag'] = function(block, generator) {
    return '// Program starts here\nsend_msg(\'Wake Up\');\n';
};

javascriptGenerator.forBlock['stop_flag'] = function(block, generator) {
    return '// Program ends here\ncmd_dropdown("self.system.quit", {});\ninterpreter.stop();\n';
};

// Class wrapper for compatibility with existing code
class CodeGenerator {
    constructor() {
        this.isInitialized = true; // Generators are set up immediately
        console.log('✅ Code generators initialized using forBlock pattern');
    }

    isReady() {
        return this.isInitialized && window.Blockly && window.Blockly.Python && window.Blockly.JavaScript;
    }

    // Force re-initialization (not needed with forBlock pattern, but kept for compatibility)
    forceInit() {
        console.log('✅ Code generators already initialized with forBlock pattern');
        return true;
    }

    // Generate Python code from workspace (for display)
    generatePython() {
        if (!window.workspace) {
            return '# No workspace available';
        }

        try {
            let code = Blockly.Python.workspaceToCode(window.workspace);
            
            // Add header comment
            const header = `# Generated Python Code\n# This is for visualization only\n\n`;
            
            // Add Santa API functions if any Santa commands are used
            if (code.includes('execute_santa_command(') || code.includes('send_message(')) {
                const santaAPI = this.generateSantaAPICode();
                code = header + santaAPI + '\n' + code;
            } else {
                code = header + code;
            }

            return code || '# No blocks to generate code from';
        } catch (error) {
            console.error('Error generating Python code:', error);
            return `# Error generating code: ${error.message}`;
        }
    }

    // Generate JavaScript code from workspace (for execution)
    generateJavaScript() {
        if (!window.workspace) {
            return '// No workspace available';
        }

        try {
            let code = Blockly.JavaScript.workspaceToCode(window.workspace);
            
            // Add header comment
            const header = `// Generated JavaScript Code\n// This code is for execution\n\n`;
            
            // Add execution helper functions
            const helpers = this.generateExecutionHelpers();
            
            return header + helpers + '\n' + (code || '// No blocks to generate code from');
        } catch (error) {
            console.error('Error generating JavaScript code:', error);
            return `// Error generating code: ${error.message}`;
        }
    }

    // Generate Santa API code for Python display
    generateSantaAPICode() {
        return `# Santa API Functions
def send_message(text):
    print(f"Sending message: {text}")

def execute_santa_command(command, parameters):
    """Execute a Santa command with parameters (similar to JavaScript version)"""
    if parameters:
        param_str = ", ".join([f"{k}={v}" for k, v in parameters.items()])
        print(f"Executing Santa command: {command}({param_str})")
    else:
        print(f"Executing Santa command: {command}()")
    
    # Simulate some common commands for display purposes
    if "volume" in command:
        volume = parameters.get("volume", 50)
        print(f"Santa sets volume to {volume}")
    elif "shake" in command:
        if "start" in command:
            print("Santa starts shaking")
        elif "stop" in command:
            print("Santa stops shaking")
    elif "move" in command:
        if "forward" in command:
            distance = parameters.get("distance", 1)
            speed = parameters.get("speed", "medium")
            print(f"Santa moves forward {distance} units at {speed} speed")
        elif "backward" in command:
            distance = parameters.get("distance", 1)
            speed = parameters.get("speed", "medium")
            print(f"Santa moves backward {distance} units at {speed} speed")
    elif "turn" in command:
        angle = parameters.get("angle", 90)
        if "left" in command:
            print(f"Santa turns left {angle} degrees")
        elif "right" in command:
            print(f"Santa turns right {angle} degrees")
    else:
        print(f"Santa executes: {command}")

`;
    }

    // Generate execution helper functions for JavaScript - V2 Compatible
    generateExecutionHelpers() {
        return `// Execution Helper Functions - V2 Compatible
// Runtime functions for generated JavaScript execution
async function sendSantaText(text) {
  if (!window.bleManager || !window.bleManager.isConnected) {
    throw new Error('BLE device not connected');
  }
  
  const message = {
    type: 'text',
    text: text
  };
  
  console.log('Sending text to Santa:', text);
  return await window.bleManager.sendMessage(message);
}

async function executeSantaCommand(toolName, parameters = {}) {
  if (!window.bleManager || !window.bleManager.isConnected) {
    throw new Error('BLE device not connected');
  }
  
  console.log('Executing Santa command:', toolName, parameters);
  return await window.bleManager.executeToolByName(toolName, parameters);
}

// Synchronous functions for interpreter
function send_msg(text) {
    console.log('Sending message:', text);
    if (window.bleManager && window.bleManager.isConnected) {
        // Send via BLE if available
        window.bleManager.sendMessage({
            type: 'text',
            text: text
        });
    } else {
        console.log('BLE not connected, message:', text);
    }
}

function cmd_dropdown(toolName, parameters = {}) {
    console.log('Executing command:', toolName, parameters);
    if (window.bleManager && window.bleManager.isConnected) {
        // Execute via BLE if available
        window.bleManager.executeToolByName(toolName, parameters);
    } else {
        console.log('BLE not connected, would execute:', toolName, parameters);
    }
}

// Global execution context
var interpreter = {
    stop: function() {
        console.log('Program execution stopped');
        if (window.blocklyInterpreter) {
            window.blocklyInterpreter.stop();
        }
    }
};

`;
    }

    // Get both Python and JavaScript code
    generateAll() {
        return {
            python: this.generatePython(),
            javascript: this.generateJavaScript()
        };
    }

    // Get Santa-specific code (for the Copy Santa Code button)
    generateSantaCode() {
        if (!window.workspace) {
            return '# No workspace available';
        }

        try {
            // Get all blocks in the workspace
            const blocks = window.workspace.getAllBlocks(false);
            const santaBlocks = blocks.filter(block => 
                block.type === 'send_cmd_dropdown' || 
                block.type === 'send_msg'
            );

            if (santaBlocks.length === 0) {
                return '# No Santa commands found in workspace';
            }

            let code = '# Santa Commands Only\n\n';
            code += this.generateSantaAPICode();
            
            santaBlocks.forEach(block => {
                if (block.type === 'send_msg') {
                    const text = Blockly.Python.valueToCode(block, 'TEXT', Blockly.Python.ORDER_ATOMIC) || '""';
                    code += `send_message(${text})\n`;
                } else if (block.type === 'send_cmd_dropdown') {
                    const command = block.getFieldValue('CMD');
                    if (command && command !== 'NONE') {
                        // Use the same parameter extraction as the generator
                        let parameters = {};
                        if (typeof block.getParameterValues === 'function') {
                            parameters = block.getParameterValues();
                        }
                        
                        const paramEntries = [];
                        for (const [paramName, paramValue] of Object.entries(parameters)) {
                            if (typeof paramValue === 'string' && paramValue.startsWith('[[') && paramValue.endsWith(']]')) {
                                const inputName = paramValue.slice(2, -2);
                                const valueBlock = block.getInputTargetBlock(inputName);
                                if (valueBlock) {
                                    paramEntries.push(`"${paramName}": "<value from connected block>"`);
                                }
                            } else {
                                let pythonValue;
                                if (typeof paramValue === 'boolean') {
                                    pythonValue = paramValue ? 'True' : 'False';
                                } else if (typeof paramValue === 'string') {
                                    pythonValue = `"${paramValue}"`;
                                } else {
                                    pythonValue = String(paramValue);
                                }
                                paramEntries.push(`"${paramName}": ${pythonValue}`);
                            }
                        }

                        const paramStr = paramEntries.length > 0 ? `{${paramEntries.join(', ')}}` : '{}';
                        code += `execute_santa_command("${command}", ${paramStr})\n`;
                    }
                }
            });

            return code;
        } catch (error) {
            console.error('Error generating Santa code:', error);
            return `# Error generating Santa code: ${error.message}`;
        }
    }

    generatePythonCode() {
        try {
            const code = window.Blockly.Python.workspaceToCode(window.workspace);
            console.log('✅ Generated Python code:', code);
            return code || '# No blocks in workspace\n';
        } catch (error) {
            console.error('Error generating Python code:', error);
            return `# Error generating code: ${error.message}\n`;
        }
    }

    generateJavaScriptCode() {
        try {
            const code = window.Blockly.JavaScript.workspaceToCode(window.workspace);
            console.log('✅ Generated JavaScript code:', code);
            return code || '// No blocks in workspace\n';
        } catch (error) {
            console.error('Error generating JavaScript code:', error);
            return `// Error generating code: ${error.message}\n`;
        }
    }
}

// Initialize the code generator
window.codeGenerator = new CodeGenerator();

// Make the individual generator functions available globally (for compatibility)
window.generateJavaScriptCode = function() {
    return window.codeGenerator.generateJavaScriptCode();
};

window.generatePythonCode = function() {
    return window.codeGenerator.generatePythonCode();
};

// Add v2 compatible functions from the attachment
function generateInterpreterCode() {
  const workspace = Blockly.getMainWorkspace();
  
  // Temporarily modify the generators to produce sync code
  const originalGenerators = {};
  const blockTypes = ['send_msg', 'send_cmd_dropdown', 'start_flag', 'stop_flag', 'procedures_defnoreturn', 'procedures_defreturn'];
  
  // Store original generators
  blockTypes.forEach(blockType => {
    originalGenerators[blockType] = javascriptGenerator.forBlock[blockType];
  });
  
  // Override generators to produce synchronous code
  javascriptGenerator.forBlock['send_msg'] = function(block, generator) {
    const text = generator.valueToCode(block, 'TEXT', javascriptGenerator.ORDER_ATOMIC) || '""';
    const code = `send_msg(${text});\n`;
    return code;
  };

  javascriptGenerator.forBlock['send_cmd_dropdown'] = function(block, generator) {
    const toolName = block.getFieldValue('CMD');
    
    // Get parameter values if the block has the method
    let parameters = {};
    if (typeof block.getParameterValues === 'function') {
        parameters = block.getParameterValues();
    }
    
    // Generate parameter object
    let paramCode = '{';
    const paramEntries = [];
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (typeof paramValue === 'string' && paramValue.startsWith('[[') && paramValue.endsWith(']]')) {
            // This is a placeholder for a connected block value
            const inputName = paramValue.slice(2, -2); // Remove [[ and]]
            const connectedValue = generator.valueToCode(block, inputName, javascriptGenerator.ORDER_ATOMIC) || 'null';
            paramEntries.push(`${paramName}: ${connectedValue}`);
        } else {
            // Direct value (boolean, enum, etc.)
            const jsonValue = JSON.stringify(paramValue);
            paramEntries.push(`${paramName}: ${jsonValue}`);
        }
    }
    
    paramCode += paramEntries.join(', ') + '}';
    
    // Pass parameters as JSON string to executeSantaCommand so it can parse and detect Time parameter
    const code = `executeSantaCommand("${toolName}", JSON.stringify(${paramCode}));\n`;
    return code;
  };

  // Generate the code
  const interpreterCode = javascriptGenerator.workspaceToCode(workspace);
  
  // Restore original generators
  blockTypes.forEach(blockType => {
    if (originalGenerators[blockType]) {
        javascriptGenerator.forBlock[blockType] = originalGenerators[blockType];
    }
  });

  console.log('Generated Interpreter Code:\n', interpreterCode);
  return interpreterCode;
}

// Runtime functions for generated JavaScript execution - V2 Compatible
async function sendSantaText(text) {
  if (!window.bleManager || !window.bleManager.isConnected) {
    throw new Error('BLE device not connected');
  }
  
  const message = {
    type: 'text',
    text: text
  };
  
  console.log('Sending text to Santa:', text);
  return await window.bleManager.sendMessage(message);
}

async function executeSantaCommand(toolName, parameters = {}) {
  if (!window.bleManager || !window.bleManager.isConnected) {
    throw new Error('BLE device not connected');
  }
  
  console.log('Executing Santa command:', toolName, parameters);
  return await window.bleManager.executeToolByName(toolName, parameters);
}

// Function to execute generated JavaScript code
async function executeGeneratedCode() {
  try {
    const jsCode = generateJavaScriptCode();
    
    if (!jsCode.trim()) {
        console.warn('No code to execute');
        return;
    }
    
    console.log('Executing generated code...');
    
    // Create a function from the generated code and execute it
    const executeCode = new Function(jsCode);
    await executeCode();
    
    console.log('Code execution completed');
  } catch (error) {
    console.error('Error executing generated code:', error);
    throw error;
  }
}

// Make v2 functions globally available
window.generateInterpreterCode = generateInterpreterCode;
window.sendSantaText = sendSantaText;
window.executeSantaCommand = executeSantaCommand;
window.executeGeneratedCode = executeGeneratedCode;

console.log('✅ Code Generator initialized with V2 compatible API');
