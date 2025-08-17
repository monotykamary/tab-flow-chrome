<div align="center">
  
# 🌊 Tab Flow - Modern Tab Manager

A powerful Chrome extension for managing tabs with workflow automation, dark theme support, and smart organization features.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/monotykamary)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-blue?style=for-the-badge&logo=google-chrome)](https://chromewebstore.google.com/detail/cglhpbmjmnnfhnhnimgmademhaemmdlg)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="screenshots/tabflow1.png" alt="Tab Flow Main View" width="400"/><br/>
      <sub><b>Main Tab View</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/tabflow2.png" alt="Tab Flow Analytics" width="400"/><br/>
      <sub><b>Analytics Dashboard</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/tabflow4.png" alt="Tab Flow Automations" width="400"/><br/>
      <sub><b>Automation Rules</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/tabflow3.png" alt="Tab Flow Settings" width="400"/><br/>
      <sub><b>Settings & Configuration</b></sub>
    </td>
  </tr>
</table>

## ✨ Features

### 🎨 Modern UI/UX
- **Dark/Light Theme** - Automatic system theme detection with custom accent colors
- **Glassmorphism Design** - Beautiful frosted glass effects throughout the interface
- **Smooth Animations** - Polished micro-interactions with Framer Motion
- **Keyboard Navigation** - Navigate search results with arrow keys and Enter
- **No Flash on Load** - Instant theme application prevents white flash in dark mode
- **Gradient Animations** - Dynamic gradient highlights for search results
- **Auto-highlight** - First search result automatically highlighted for quick access

### 🤖 Workflow Automation
- **Auto-Archive** - Automatically archive inactive tabs after customizable time
- **Daily Cleanup** - Schedule automatic tab cleanup at your preferred time
- **Duplicate Detection** - Smart duplicate tab detection with exact URL matching
- **Memory Management** - Monitor and limit memory usage with configurable thresholds
- **Tab Limits** - Enforce maximum tab counts with automatic archiving
- **Auto-Collapse Groups** - Automatically collapse inactive tab groups with customizable delay
- **Persistent Automations** - All automation rules persist across extension reloads

### 💼 Tab Organization
- **Tab Groups** - Visual organization with customizable colors
- **Save Groups** - Save and restore tab groups as workspaces
- **Unique Groups** - Automatic deduplication ensures each group is saved only once
- **Smart Restoration** - Intelligent tab loading detection for reliable group restoration
- **Auto-Save** - Groups automatically save when created or modified
- **Bulk Actions** - Close entire groups with one click
- **Search & Filter** - Fast search across all tabs with real-time filtering
- **Hidden Closed Groups** - Saved groups that are closed don't clutter search results

### 📊 Analytics & Insights
- **Tab Analytics** - Track active, archived, and closed tabs
- **Domain Statistics** - See your most visited domains
- **Activity Visualization** - Beautiful charts showing tab activity
- **Average Lifespan** - Track how long tabs stay open

## 🔧 Performance

- **Optimized Background Script** - Cached settings reduce storage API calls by 90%
- **Batched Operations** - Multiple operations executed in parallel for speed
- **Debounced Events** - Window focus changes debounced to prevent excessive processing
- **Minimal Redraws** - Smart state management prevents unnecessary animations

## 🚀 Installation

### Chrome Web Store

Install directly from the Chrome Web Store:

[![Install from Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-blue?style=for-the-badge&logo=google-chrome)](https://chromewebstore.google.com/detail/cglhpbmjmnnfhnhnimgmademhaemmdlg)

### From Source

1. Clone the repository:
```bash
git clone https://github.com/monotykamary/tab-flow-chrome.git
cd tab-flow-chrome

# Ensure Bun is installed
# macOS/Linux: curl -fsSL https://bun.sh/install | bash
# Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"
```

2. Install dependencies (Bun):
```bash
bun install
```

3. Build the extension:
```bash
bun run build
```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## 🛠️ Development

Start the development server with hot reload:
```bash
bun run dev
```

Build for production:
```bash
bun run build
```

## ⌨️ Keyboard Shortcuts

- `Cmd/Ctrl + Shift + A`: Open Tab Flow and focus search
- `Arrow Up/Down`: Navigate search results
- `Enter`: Switch to selected tab
- **Secret**: `Cmd/Ctrl + Shift + A` → `Enter` (empty search) - Quick-switch to previous tab

## 🔧 Technologies

- **React 18** with TypeScript for type-safe development
- **Vite** for lightning-fast builds and HMR
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **Radix UI** for accessible components
- **Recharts** for beautiful analytics charts
- **Chrome Extension Manifest V3** for modern extension APIs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 💖 Support

If you find Tab Flow helpful, consider supporting the development:

<a href="https://buymeacoffee.com/monotykamary" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217">
</a>

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Icons from [Radix UI](https://www.radix-ui.com/icons)
- Glassmorphism inspiration from [Glassmorphism.com](https://glassmorphism.com/)
- Built with ❤️ by [monotykamary](https://github.com/monotykamary)