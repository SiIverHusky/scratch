// Enhanced Execution Controller with Dynamic Timing
// Compatible with our existing setup

// Global execution state
let currentInterpreter = null;
let isExecuting = false;
let executionMode = 'stopped'; // 'stopped', 'fullSpeed', 'blockByBlock', 'stepping'
let stopBlockExecuted = false; // Flag to track if stop block was executed
let executionTimeoutId = null; // Track the timeout ID for block-by-block execution
let nextStepDelay = null; // One-time delay override for Time parameter (in ms)

function highlightBlock(id) {
  if (window.workspace) {
    window.workspace.highlightBlock(id);
  }
}

function showToast(message, options = {}) {
  console.log('📢 Toast:', message);
  // Use existing toast system if available
  if (window.toast && window.toast.info) {
    window.toast.info(message);
  } else if (window.toastController && window.toastController.show) {
    window.toastController.show(message, options);
  }
}

function updateExecutionUI() {
  console.log('🎮 updateExecutionUI called');
  
  const runBtn = document.getElementById('runBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (!runBtn || !stopBtn) {
    // Buttons not available yet, schedule retry
    console.log('⚠️ Buttons not found, retrying in 100ms...');
    setTimeout(updateExecutionUI, 100);
    return;
  }
  
  // Simple Bluetooth connection check with logging
  let isBluetoothConnected = false;
  
  // Try multiple methods to check connection
  if (window.bleManager && typeof window.bleManager.isConnected === 'boolean') {
    isBluetoothConnected = window.bleManager.isConnected;
    console.log('📡 Bluetooth check via bleManager:', isBluetoothConnected);
  } else if (window.bluetoothController && typeof window.bluetoothController.isDeviceConnected === 'function') {
    try {
      isBluetoothConnected = window.bluetoothController.isDeviceConnected();
      console.log('📡 Bluetooth check via bluetoothController:', isBluetoothConnected);
    } catch (error) {
      console.warn('⚠️ Error checking via bluetoothController:', error);
    }
  } else if (window.isBluetoothConnected && typeof window.isBluetoothConnected === 'function') {
    try {
      isBluetoothConnected = window.isBluetoothConnected();
      console.log('📡 Bluetooth check via global function:', isBluetoothConnected);
    } catch (error) {
      console.warn('⚠️ Error checking via global function:', error);
    }
  } else {
    console.log('📡 No Bluetooth check method available, assuming disconnected');
  }
  
  console.log(`🎮 Updating UI - Executing: ${isExecuting}, Bluetooth: ${isBluetoothConnected}`);
  
  // Simple approach: Hide/show buttons based on connection and execution state
  if (isExecuting) {
    // When executing: hide run button, show stop button
    runBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    console.log('🎮 UI: Showing stop button (executing)');
  } else if (isBluetoothConnected) {
    // When connected but not executing: show run button, hide stop button
    runBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    // Remove any disabled state and ensure button works normally
    runBtn.disabled = false;
    runBtn.title = 'Run Program';
    runBtn.style.opacity = '1';
    runBtn.style.cursor = 'pointer';
    runBtn.style.pointerEvents = 'auto';
    console.log('🎮 UI: Showing run button (connected)');
  } else {
    // When not connected: hide both buttons
    runBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    console.log('🎮 UI: Hiding both buttons (no Bluetooth)');
  }
}

function initializeInterpreter() {
  // Use our existing code generation
  if (!window.workspace) {
    throw new Error('Workspace not available');
  }
  
  const code = Blockly.JavaScript.workspaceToCode(window.workspace);
  console.log('🔄 Generated code for execution:', code);
  
  function initApi(interpreter, globalObject) {
    // Console support
    const consoleWrapper = interpreter.createObjectProto(interpreter.OBJECT_PROTO);
    interpreter.setProperty(globalObject, 'console', consoleWrapper);
    interpreter.setProperty(consoleWrapper, 'log', 
      interpreter.createNativeFunction(function(text) {
        console.log('🤖 Program output:', String(text));
        return true;
      })
    );

        // Santa Robot API functions - V2 Compatible
    interpreter.setProperty(globalObject, 'send_msg', interpreter.createNativeFunction(function(text) {
      console.log('Sending Santa text:', text);
      
      // Check if BLE is connected before sending
      if (!window.bleManager || !window.bleManager.isConnected) {
        console.warn('BLE device not connected - message not sent:', text);
        showToast('BLE device not connected', { duration: 3000 });
        return;
      }
      
      const textStr = String(text);
      
      // Check if the text is JSON (starts with { and ends with })
      if (textStr.trim().startsWith('{') && textStr.trim().endsWith('}')) {
        // Send as raw JSON command
        try {
          const jsonMessage = JSON.parse(textStr);
          if (window.sendMessage) {
            window.sendMessage(jsonMessage).catch(error => {
              console.error('Error sending JSON command:', error);
              showToast('Error sending command: ' + error.message, { duration: 3000 });
            });
          }
        } catch (e) {
          console.error('Invalid JSON in send_msg:', textStr, e);
          showToast('Invalid JSON command: ' + e.message, { duration: 3000 });
        }
      } else {
        // Send as regular text message using existing function
        if (window.sendSantaText) {
          window.sendSantaText(textStr).catch(error => {
            console.error('Error sending Santa text:', error);
            showToast('Error sending message: ' + error.message, { duration: 3000 });
          });
        }
      }
      return text;
    }));

    interpreter.setProperty(globalObject, 'cmd_dropdown', interpreter.createNativeFunction(function(toolName, parameters) {
      // Reliable conversion using interpreter's built-in pseudoToNative (handles deep structures & arrays)
      let nativeParams;
      try {
        nativeParams = interpreter.pseudoToNative ? interpreter.pseudoToNative(parameters) : parameters;
      } catch (e) {
        console.warn('pseudoToNative conversion failed, falling back to empty object', e);
        nativeParams = {};
      }

      // Defensive: ensure plain object
      if (!nativeParams || typeof nativeParams !== 'object' || Array.isArray(nativeParams)) {
        nativeParams = nativeParams && typeof nativeParams === 'object' ? nativeParams : {};
      }

      console.log('Executing Santa command:', toolName, nativeParams);
      
      // Check for Time parameter (case-insensitive)
      for (const key in nativeParams) {
        if (key.toLowerCase() === 'time') {
          const timeValue = Number(nativeParams[key]) || 0;
          if (timeValue > 0) {
            nextStepDelay = timeValue * 1000; // Convert seconds to milliseconds
            console.log('⏱️ Time parameter detected:', timeValue, 'seconds (', nextStepDelay, 'ms)');
          }
          break;
        }
      }
      
      // Check if BLE is connected before sending command
      if (!window.bleManager || !window.bleManager.isConnected) {
        console.warn('BLE device not connected - command not sent:', toolName);
        showToast('BLE device not connected', { duration: 3000 });
        return;
      }
      
      // Execute the command using v2 compatible function
      if (window.executeSantaCommand) {
        window.executeSantaCommand(toolName, nativeParams).catch(error => {
          console.error('Error executing Santa command:', error);
          showToast('Error executing command: ' + error.message, { duration: 3000 });
        });
      }
      return toolName;
    }));

    // Block highlighting
    interpreter.setProperty(globalObject, 'highlightBlock',
      interpreter.createNativeFunction(function(id) {
        if (id && window.workspace) {
          const blockId = String(id);
          window.workspace.highlightBlock(blockId);
          console.log('🎯 Highlighting block:', blockId);
        }
        return true;
      })
    );

    // Math support (essential for our generated code)
    const mathWrapper = interpreter.createObjectProto(interpreter.OBJECT_PROTO);
    interpreter.setProperty(globalObject, 'Math', mathWrapper);
    
    interpreter.setProperty(mathWrapper, 'random',
      interpreter.createNativeFunction(function() {
        return Math.random();
      })
    );
    
    interpreter.setProperty(mathWrapper, 'floor',
      interpreter.createNativeFunction(function(x) {
        return Math.floor(Number(x));
      })
    );

    // mathRandomInt helper (used in our generated code)
    interpreter.setProperty(globalObject, 'mathRandomInt',
      interpreter.createNativeFunction(function(a, b) {
        const min = Number(a);
        const max = Number(b);
        const result = Math.floor(Math.random() * (max - min + 1) + min);
        return result;
      })
    );

    // Window object with LoopTrap
    const windowWrapper = interpreter.createObjectProto(interpreter.OBJECT_PROTO);
    interpreter.setProperty(globalObject, 'window', windowWrapper);
    interpreter.setProperty(windowWrapper, 'LoopTrap', 1000);

    // Interpreter stop method for stop blocks
    interpreter.setProperty(globalObject, 'interpreter', 
      interpreter.createObjectProto(interpreter.OBJECT_PROTO));
    interpreter.setProperty(interpreter.getProperty(globalObject, 'interpreter'), 'stop',
      interpreter.createNativeFunction(function() {
        console.log('🛑 Stop block executed');
        stopBlockExecuted = true;
        return true;
      })
    );

    // Add setVar function for variable tracking
    interpreter.setProperty(globalObject, 'setVar',
      interpreter.createNativeFunction(function(rawId) {
        const rawIdStr = String(rawId);
        console.log('🔧 setVar called with:', rawIdStr);
        
        // Extract variable information - format: blockId=variableName
        try {
          const splitIndex = rawIdStr.lastIndexOf('=');
          if (splitIndex !== -1) {
            const blockId = rawIdStr.slice(0, splitIndex);
            const variableName = rawIdStr.slice(splitIndex + 1);
            
            // Get the actual value from the interpreter's global object
            let actualValue = 'undefined';
            
            // Try to get the variable value from the global object
            try {
              const variableProperty = interpreter.getProperty(globalObject, variableName);
              if (variableProperty !== undefined) {
                // Handle JS-Interpreter values correctly
                if (variableProperty && typeof variableProperty === 'object' && 'data' in variableProperty) {
                  actualValue = variableProperty.data;
                } else if (variableProperty && typeof variableProperty === 'object' && 'toString' in variableProperty) {
                  actualValue = variableProperty.toString();
                } else {
                  // Direct primitive value
                  actualValue = variableProperty;
                }
                console.log(`📊 Variable ${variableName} = ${actualValue} (type: ${typeof actualValue}, raw: ${typeof variableProperty})`);
              } else {
                console.log(`⚠️ Variable ${variableName} not found in global scope`);
                // Try to get from the current interpreter state
                const stateStr = interpreter.stateStack && interpreter.stateStack.length > 0 ? 
                  JSON.stringify(interpreter.stateStack[0], null, 2) : 'No state';
                console.log('Current interpreter state:', stateStr);
                actualValue = 'undefined';
              }
            } catch (scopeError) {
              console.warn(`Could not access variable ${variableName}:`, scopeError);
              actualValue = 'undefined';
            }
            
            // Update variables pane
            if (typeof window.setVariableInPane === 'function') {
              window.setVariableInPane(variableName, actualValue, blockId);
            }
          } else {
            console.warn('Invalid setVar format:', rawIdStr);
          }
        } catch (error) {
          console.error('Error in setVar:', error);
        }
        
        return true;
      })
    );
  }

  currentInterpreter = new Interpreter(code, initApi);
  return currentInterpreter;
}

function runFullSpeed() {
  if (isExecuting) {
    console.warn('Code is already executing');
    return;
  }
  
  // Check Bluetooth connection before starting
  if (!window.bleManager || !window.bleManager.isConnected) {
    console.warn('❌ Cannot run: BLE device not connected');
    showToast('Please connect to Santa-Bot first', { duration: 3000 });
    return;
  }
  
  try {
    initializeInterpreter();
    isExecuting = true;
    executionMode = 'fullSpeed';
    stopBlockExecuted = false; // Reset flag
    
    // Clear any previous highlighting
    if (window.workspace) {
      window.workspace.highlightBlock(null);
    }
    
    // Hide refresh button during execution
    if (window.variablesPaneController) {
      window.variablesPaneController.hideRefreshButton();
    }
    
    console.log('🚀 Starting full speed execution...');
    showToast('Running at full speed...');
    updateExecutionUI(); // Update button state
    
    while (currentInterpreter.step()) {
      // Check if stop block was executed
      if (stopBlockExecuted) {
        stopExecution();
        showToast('Program stopped by Stop block');
        console.log('🛑 Program stopped by Stop block');
        return;
      }
    }
    
    // Execution completed naturally
    stopExecution();
    showToast('Code execution completed!');
    console.log('✅ Full speed execution completed');
  } catch (error) {
    console.error('❌ Error during full speed execution:', error);
    showToast('Error during execution: ' + error.message, { duration: 5000 });
    stopExecution();
  }
}

function runBlockByBlock(timeout = 10) {
  if (isExecuting && executionMode !== 'blockByBlock') {
    console.warn('Code is already executing in a different mode');
    return;
  }
  
  if (!isExecuting) {
    // Check Bluetooth connection before starting
    if (!window.bleManager || !window.bleManager.isConnected) {
      console.warn('❌ Cannot run: BLE device not connected');
      showToast('Please connect to Santa-Bot first', { duration: 3000 });
      return;
    }
    
    initializeInterpreter();
    isExecuting = true;
    executionMode = 'blockByBlock';
    stopBlockExecuted = false; // Reset flag
    executionTimeoutId = null; // Reset timeout ID
    
    if (window.workspace) {
      window.workspace.highlightBlock(null);
    }
    
    // Hide refresh button during execution
    if (window.variablesPaneController) {
      window.variablesPaneController.hideRefreshButton();
    }
    
    console.log('🚀 Starting block-by-block execution...');
    showToast('Starting block-by-block execution...');
    updateExecutionUI(); // Update button state
  }
  
  try {
    if (currentInterpreter.step()) {
      // Check if Bluetooth connection was lost during execution
      if (!window.bleManager || !window.bleManager.isConnected) {
        console.log('🔗 Bluetooth connection lost during execution');
        handleBluetoothDisconnection();
        return;
      }
      
      // Check if execution was stopped while we were stepping
      if (!isExecuting) {
        console.log('🛑 Execution was stopped during step, aborting...');
        return;
      }
      
      // Check if stop block was executed
      if (stopBlockExecuted) {
        stopExecution();
        showToast('Program stopped by Stop block');
        console.log('🛑 Program stopped by Stop block');
        return;
      }
      
      // Get dynamic timeout based on operation type
      let dynamicTimeout = getDynamicTimeout(currentInterpreter, timeout);
      
      // Use nextStepDelay if set (for Time parameters), otherwise use dynamicTimeout
      if (nextStepDelay !== null) {
        console.log('⏱️ Using nextStepDelay:', nextStepDelay, 'ms (overriding default:', dynamicTimeout, 'ms)');
        dynamicTimeout = nextStepDelay;
        nextStepDelay = null; // Reset after use
      } else {
        console.log('⏱️ Using default timeout:', dynamicTimeout, 'ms');
      }
      
      executionTimeoutId = setTimeout(() => {
        // Double-check that execution is still running before continuing
        if (isExecuting && executionMode === 'blockByBlock') {
          runBlockByBlock(timeout);
        }
      }, dynamicTimeout);
    } else {
      // Execution completed naturally
      stopExecution();
      showToast('Block-by-block execution completed!');
      console.log('✅ Block-by-block execution completed');
    }
  } catch (error) {
    console.error('❌ Error during block-by-block execution:', error);
    showToast('Error during execution: ' + error.message, { duration: 5000 });
    stopExecution();
  }
}

function getDynamicTimeout(interpreter, defaultTimeout) {
  // Check if we can determine the current operation type
  try {
    const stateStack = interpreter.getStateStack();
    const currentState = stateStack && stateStack.length > 0 ? stateStack[stateStack.length - 1] : null;
    
    if (!currentState || !currentState.node) {
      return defaultTimeout;
    }
    
    const node = currentState.node;
    
    // Apply delays for specific operations
    if (node.type === 'CallExpression' && node.callee) {
      const functionName = node.callee.name;
      
      switch (functionName) {
        case 'send_msg':
          return 1000; // BLE message commands - consistent with v2
        case 'cmd_dropdown':
          return getBLECommandTimeout(node, defaultTimeout);
        case 'sendSantaText':
          return 1000; // v2 async function for text
        case 'executeSantaCommand':
          return getBLECommandTimeout(node, defaultTimeout); // v2 async function for commands
        case 'highlightBlock':
          return 10; // Very quick highlight
        default:
          return defaultTimeout;
      }
    }
    
    // Different delays for different statement types
    switch (node.type) {
      case 'WhileStatement':
      case 'ForStatement':
        return Math.min(defaultTimeout, 50); // Much faster for loops
      case 'IfStatement':
        return Math.min(defaultTimeout, 50); // Much faster for conditionals
      case 'VariableDeclaration':
      case 'AssignmentExpression':
        return Math.min(defaultTimeout, 30); // Very fast for assignments
      default:
        return defaultTimeout;
    }
  } catch (error) {
    console.log('Could not determine dynamic timeout, using default');
    return defaultTimeout;
  }
}

function getBLECommandTimeout(node, defaultTimeout) {
  // All BLE commands get 1000ms timeout
  return 1000;
}

function stepOnce() {
  if (isExecuting && executionMode !== 'stepping') {
    console.warn('Code is already executing in a different mode');
    return;
  }
  
  if (!isExecuting) {
    // Check Bluetooth connection before starting
    if (!window.bleManager || !window.bleManager.isConnected) {
      console.warn('❌ Cannot run: BLE device not connected');
      showToast('Please connect to Santa-Bot first', { duration: 3000 });
      return;
    }
    
    initializeInterpreter();
    isExecuting = true;
    executionMode = 'stepping';
    stopBlockExecuted = false; // Reset flag
    
    if (window.workspace) {
      window.workspace.highlightBlock(null);
    }
    
    // Hide refresh button during execution
    if (window.variablesPaneController) {
      window.variablesPaneController.hideRefreshButton();
    }
    
    console.log('🚀 Starting step-by-step execution...');
    showToast('Starting step-by-step execution...');
    updateExecutionUI(); // Update button state
  }
  
  try {
    if (currentInterpreter.step()) {
      // Check if stop block was executed
      if (stopBlockExecuted) {
        stopExecution();
        showToast('Program stopped by Stop block');
        console.log('🛑 Program stopped by Stop block');
        return;
      }
      
      showToast('Step executed. Click Step Once again to continue.');
      console.log('👣 Step executed, waiting for next step...');
    } else {
      stopExecution();
      showToast('Step execution completed!');
      console.log('✅ Step execution completed');
    }
  } catch (error) {
    console.error('❌ Error during step execution:', error);
    showToast('Error during execution: ' + error.message, { duration: 5000 });
    stopExecution();
  }
}

function stopExecution() {
  isExecuting = false;
  executionMode = 'stopped';
  currentInterpreter = null;
  stopBlockExecuted = false; // Reset flag
  nextStepDelay = null; // Reset any pending Time delay
  
  // Clear any pending timeout to prevent restart
  if (executionTimeoutId) {
    clearTimeout(executionTimeoutId);
    executionTimeoutId = null;
    console.log('🚫 Cleared pending execution timeout');
  }
  
  // Clear any highlighting
  if (window.workspace) {
    window.workspace.highlightBlock(null);
  }
  
  // Show refresh button when execution stops
  if (window.variablesPaneController) {
    window.variablesPaneController.showRefreshButton();
  }
  
  console.log('⏹️ Execution stopped');
  updateExecutionUI(); // Update button state
}

function resetExecution() {
  stopExecution();
  showToast('Execution reset!');
  console.log('🔄 Execution reset');
}

function handleBluetoothDisconnection() {
  if (isExecuting) {
    console.log('🔗 Bluetooth disconnected during execution - stopping program');
    stopExecution();
    showToast('Program stopped: Santa-Bot disconnected', { duration: 5000 });
  }
  updateExecutionUI(); // Update button state
}

// Expose functions globally for compatibility with existing setup
window.runFullSpeed = runFullSpeed;
window.runBlockByBlock = runBlockByBlock;
window.stepOnce = stepOnce;
window.stopExecution = stopExecution;
window.resetExecution = resetExecution;
window.isExecuting = () => isExecuting;
window.getExecutionMode = () => executionMode;
window.updateExecutionUI = updateExecutionUI;
window.handleBluetoothDisconnection = handleBluetoothDisconnection;

// Also expose the individual functions used by our existing interpreter
window.initializeInterpreter = initializeInterpreter;
window.highlightBlock = highlightBlock;

// Debug functions for cloud hosting troubleshooting
window.debugRunButton = function() {
  console.log('🔍 Debug Run Button State:');
  const runBtn = document.getElementById('runBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  console.log('Run Button:', {
    exists: !!runBtn,
    disabled: runBtn?.disabled,
    style: runBtn?.style.cssText,
    onclick: !!runBtn?.onclick,
    listeners: 'Cannot check addEventListener listeners'
  });
  
  console.log('Stop Button:', {
    exists: !!stopBtn,
    disabled: stopBtn?.disabled,
    style: stopBtn?.style.cssText,
    onclick: !!stopBtn?.onclick
  });
  
  console.log('Execution State:', {
    isExecuting,
    executionMode,
    runBlockByBlock: !!window.runBlockByBlock,
    stopExecution: !!window.stopExecution
  });
  
  console.log('Bluetooth State:', {
    bleManager: !!window.bleManager,
    bluetoothController: !!window.bluetoothController,
    isConnected: window.isBluetoothConnected ? window.isBluetoothConnected() : 'unknown'
  });
};

// Force run execution (for debugging)
window.forceRun = function() {
  console.log('🚀 FORCE RUN triggered');
  try {
    if (window.runBlockByBlock) {
      window.runBlockByBlock(10);
    } else {
      console.error('❌ runBlockByBlock not available');
    }
  } catch (error) {
    console.error('❌ Force run error:', error);
  }
};

// Force stop execution (for debugging)
window.forceStop = function() {
  console.log('🛑 FORCE STOP triggered');
  try {
    if (window.stopExecution) {
      window.stopExecution();
    } else {
      console.error('❌ stopExecution not available');
    }
  } catch (error) {
    console.error('❌ Force stop error:', error);
  }
};

// Override any previously defined execution functions to ensure Enhanced Execution Controller takes precedence
// This is necessary because the Xiaozhi interpreter (interpreter.js) loads before this file
// and defines its own versions of these functions
setTimeout(() => {
  // Force override after all scripts have loaded
  window.runBlockByBlock = runBlockByBlock;
  window.stopExecution = stopExecution;
  window.runContinuous = runFullSpeed; // Map runContinuous to our runFullSpeed
  window.pauseExecution = () => {
    // Enhanced execution controller doesn't support pause, so we'll stop instead
    if (isExecuting) {
      stopExecution();
      showToast('Execution stopped (pause not supported)');
    }
  };
  window.resumeExecution = () => {
    // Enhanced execution controller doesn't support resume, show message
    showToast('Resume not supported. Please restart execution.');
  };
  
  console.log('🎮 Enhanced Execution Controller functions overridden and secured');
}, 100);

// Robust initialization for cloud hosting
function initializeExecutionUI() {
  try {
    updateExecutionUI();
    console.log('✅ Execution UI initialized successfully');
  } catch (error) {
    console.warn('⚠️ Failed to initialize execution UI, retrying...', error);
    setTimeout(initializeExecutionUI, 500);
  }
}

// Initialize execution UI with multiple strategies for cloud hosting robustness
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeExecutionUI, 100);
  });
} else {
  setTimeout(initializeExecutionUI, 100);
}

// Additional initialization after window load as fallback
window.addEventListener('load', () => {
  setTimeout(initializeExecutionUI, 200);
});

console.log('🎮 Enhanced Execution Controller loaded with dynamic timing and robust cloud hosting support');
