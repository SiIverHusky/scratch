# MiniPupper Presenter

A trade show multi-robot controller for presenting MiniPupper demonstrations with customizable action buttons.

## Features

### 🐕 Multi-Robot Bluetooth Management
- Connect multiple MiniPuppers simultaneously via Web Bluetooth
- View connected robots with connection status
- Manage individual robots (view details, disconnect)
- Disconnect all robots at once

### ⚡ Customizable Action Buttons
- Create custom action buttons with:
  - Custom names and emoji icons
  - Color coding for visual organization
  - Multiple MCP instructions per button
- Each action contains a sequence of MCP tool calls
- Instructions execute in order with configurable delays
- Drag-and-drop to reorder instructions

### 🔄 Execution Modes
- **Run Once**: Execute the action instructions one time
- **Continuous Loop**: Repeat the action until manually stopped
  - Graceful stop at end of instruction sequence (prevents awkward mid-action stops)

### 💾 Persistence & Portability
- Actions are automatically saved to browser localStorage
- Import/Export actions as JSON for backup or sharing between devices

## Getting Started

### Prerequisites
- A modern browser with Web Bluetooth support (Chrome, Edge, Opera)
- MiniPupper v2 robots with Bluetooth enabled

### Running the App

The presenter is a sub-project of Block-Xiaozhi. Access it at:
```
https://your-domain/presenter/
```

Or run locally with:
```bash
cd Block-Xiaozhi
http-server -S -C your-cert.pem -K your-key.pem -p 8080
```
Then navigate to `https://localhost:8080/presenter/`

### Connecting Robots

1. Click **"+ Add Robot"** button
2. Select your MiniPupper from the Bluetooth device picker
3. Repeat to connect additional robots
4. All connected robots will execute actions simultaneously

## Creating Action Buttons

### Basic Setup

1. Click **"+ New Action"** in the Action Buttons section
2. Enter a descriptive name (e.g., "Wave Hello")
3. Choose an emoji icon
4. Select a button color
5. Add one or more MCP instructions
6. Click **Save Action**

### MCP Instructions

Each instruction consists of:
- **Tool Name**: The MCP tool to call (e.g., `minipupper_gesture`)
- **Parameters**: JSON object with tool parameters
- **Delay After**: Milliseconds to wait after this instruction completes

Example instruction:
```json
Tool: minipupper_gesture
Params: {"gesture": "wave"}
Delay: 1000
```

### Example Actions

**Wave Hello**
```json
{
  "name": "Wave Hello",
  "icon": "👋",
  "color": "#4CAF50",
  "instructions": [
    { "tool": "minipupper_gesture", "params": {"gesture": "wave"}, "delay": 1000 }
  ]
}
```

**Dance Routine**
```json
{
  "name": "Dance Routine",
  "icon": "💃",
  "color": "#E91E63",
  "instructions": [
    { "tool": "minipupper_pose", "params": {"pose": "stand"}, "delay": 500 },
    { "tool": "minipupper_action", "params": {"action": "dance"}, "delay": 3000 },
    { "tool": "minipupper_gesture", "params": {"gesture": "bow"}, "delay": 1000 }
  ]
}
```

## Running Actions

1. Click an action button
2. Choose run mode:
   - **Run Once**: Executes all instructions once
   - **Continuous Loop**: Repeats until stopped
3. Monitor execution progress in the status bar
4. Click **Stop** to end a looping action (stops at end of current cycle)

## Import/Export

### Exporting Actions
1. Click **"📁 Import/Export"**
2. Copy the JSON from the Export tab
3. Save to a file or share with others

### Importing Actions
1. Click **"📁 Import/Export"**
2. Switch to the Import tab
3. Paste JSON data
4. Click **Import Actions**
5. New actions will be merged with existing ones

## MCP Protocol

The presenter sends MCP tool calls to connected robots via Bluetooth with this format:

```json
{
  "type": "mcp_tool_call",
  "tool": "tool_name",
  "params": { ... },
  "timestamp": 1703299200000
}
```

### Supported Tools (Device Dependent)

The available MCP tools depend on your MiniPupper's firmware. Common tools include:
- `minipupper_pose` - Set body pose (stand, sit, lie down)
- `minipupper_gesture` - Perform gestures (wave, nod, shake)
- `minipupper_action` - Execute actions (dance, trot, hop)
- `minipupper_move` - Move in direction

Consult your MiniPupper documentation for the complete list of available tools.

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome (Desktop) | ✅ Full support |
| Edge | ✅ Full support |
| Opera | ✅ Full support |
| Chrome (Android) | ✅ Full support |
| Firefox | ❌ No Web Bluetooth |
| Safari | ❌ No Web Bluetooth |

## Troubleshooting

### Cannot find device
- Ensure the MiniPupper is powered on
- Check that Bluetooth is enabled on the robot
- The device advertises as "Minipupper-v2"

### Connection drops
- Stay within Bluetooth range (~10 meters)
- Avoid obstructions between the presenter device and robots
- The app will automatically detect disconnections

### Actions not executing
- Verify robot is connected (check connected robots list)
- Check browser console for error messages
- Ensure MCP tool names match what the robot expects

## License

Part of the Block-Xiaozhi project. See main LICENSE file.
