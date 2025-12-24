// Main entry point for Presenter app
// Initialize all controllers

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎪 MiniPupper Presenter initializing...');

    // Get singleton instances
    const bluetoothService = window.bluetoothService;
    const actionManager = window.actionManager;

    // Create execution controller
    const executionController = new ExecutionController(bluetoothService, actionManager);
    window.executionController = executionController;

    // Create UI controller (initializes everything)
    const uiController = new UIController(bluetoothService, actionManager, executionController);
    window.uiController = uiController;

    console.log('🎪 MiniPupper Presenter ready!');
});
