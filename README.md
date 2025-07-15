# Tab Flow - Modern Tab Manager

A powerful Chrome extension for managing tabs with workflow automation, dark theme support, and smart organization features.

## Features

### 🎨 Modern UI/UX
- **Dark/Light Theme**: Automatic system theme detection
- **Glassmorphism Design**: Beautiful frosted glass effects
- **Smooth Animations**: Polished micro-interactions
- **Density Modes**: Compact, comfortable, or spacious layouts

### 🤖 Workflow Automation
- **Auto-Archive**: Automatically archive inactive tabs after customizable time
- **Daily Cleanup**: Schedule automatic tab cleanup
- **Duplicate Detection**: Auto-close duplicate tabs
- **Memory Saver**: Suspend resource-heavy tabs automatically
- **Smart Grouping**: Rule-based automatic tab grouping

### 💼 Workspaces & Organization
- **Save/Restore Workspaces**: Save entire browser contexts
- **Tab Groups**: Visual organization with colors and icons
- **Focus Mode**: Hide all tabs except current task
- **Quick Actions**: One-click bulk operations

### 📊 Productivity Features
- **Tab Analytics**: Track browsing patterns and time spent
- **Tab Limits**: Set maximum tabs per group or total
- **Search**: Fast fuzzy search across all tabs
- **Keyboard Shortcuts**: Quick workspace switching and focus mode

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tab-flow.git
cd tab-flow
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

Start the development server:
```bash
npm run dev
```

## Keyboard Shortcuts

- `Cmd/Ctrl + Shift + F`: Toggle focus mode
- `Cmd/Ctrl + Shift + S`: Quick save workspace

## Technologies

- React 18 with TypeScript
- Vite for fast builds
- Tailwind CSS for styling
- Framer Motion for animations
- Radix UI for accessible components
- Chrome Extension Manifest V3

## License

MIT