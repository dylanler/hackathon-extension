# Visual Canvas AI - Chrome Extension

> **Capture. Organize. Create.**  
> Transform your web browsing into an intelligent visual knowledge workflow powered by AI.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285f4?style=flat-square&logo=googlechrome&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)

## 🚀 Overview

Visual Canvas AI is a revolutionary Chrome extension that transforms how you capture, organize, and leverage web content. By combining visual screenshot capture with advanced AI analysis, it creates a seamless bridge between discovery and creation.

**What makes it unique:**
- 📸 **Instant Website Capture** - Screenshot any webpage with one click
- 🎨 **Interactive Visual Canvas** - Organize screenshots into living documents
- 🤖 **AI-Powered Analysis** - Query and analyze your visual content using advanced LLMs
- ✨ **Content Generation** - Create new documents and insights from your compiled canvas
- 🔄 **Fluid Workflow** - Merge research and creation into one seamless process

## 🎯 The Problem We Solve

Traditional web research is fragmented - you bookmark pages, take scattered notes, and lose context. Visual Canvas AI revolutionizes this by:

1. **Capturing Visual Context** - Screenshots preserve the full visual story, not just text
2. **Intelligent Organization** - Your visual canvas becomes a structured knowledge base
3. **AI-Enhanced Analysis** - Leverage LLMs to extract insights from your visual data
4. **Creative Synthesis** - Transform research into new content and documents

## ✨ Key Features

### 📷 Smart Web Capture
- One-click screenshot capture from any website
- Automatic context preservation and metadata extraction
- Seamless integration with browser workflow

### 🎨 Visual Canvas Workspace
- Drag-and-drop interface for organizing screenshots
- Interactive canvas that acts as a living document
- Visual clustering and relationship mapping

### 🧠 AI-Powered Intelligence
- **Query Your Canvas** - Ask questions about your captured content
- **Deep Analysis** - Extract patterns and insights from visual data
- **Content Generation** - Create new documents based on your research
- **Synthesis Engine** - Combine multiple sources into coherent narratives

### 💬 Integrated AI Chat
- Side panel chat interface for instant AI assistance
- Persistent conversation history across sessions
- Context-aware responses based on your canvas content
- Keyboard shortcuts for efficient interaction (Ctrl/Cmd+Enter to send)

## 🛠️ Technology Stack

### **AI & Analysis**
- **OpenAI GPT-4o** - Primary LLM for content analysis and generation
- **Advanced Prompting** - Specialized prompts for visual content understanding
- **Multi-modal Processing** - Text and image analysis capabilities

### **Development Tools**
- **Design & Development**: Windsurf, Anthropic Claude Opus, GPT-5, Claude Sonnet 4.0
- **Screenshot Analysis**: OpenAI GPT-5 for visual content evaluation

### **Core Technologies**
- **React 18** - Modern component-based UI
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **TailwindCSS** - Utility-first styling
- **Chrome Extension API** - Native browser integration

### **Architecture**
- **Turborepo** - Monorepo management
- **Shared Components** - Reusable UI across extension pages
- **Persistent Storage** - Chrome storage API for data persistence
- **Hot Module Reload** - Development efficiency

## 📦 Installation

### Prerequisites
- Node.js >= 22.13.1 (check with `node --version`)
- pnpm package manager
- Chrome browser (version 88+)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/visual-canvas-ai
   cd visual-canvas-ai
   ```

2. **Install dependencies**
   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .example.env .env
   # Add your OpenAI API key:
   # CEB_OPENAI_KEY=your_openai_api_key_here
   ```

4. **Build the extension**
   ```bash
   # Development build
   pnpm dev
   
   # Production build
   pnpm build
   ```

5. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `dist` folder

## 🎯 How It Works

### 1. **Capture Phase**
- Browse any website
- Click the extension icon or use the side panel
- Capture screenshots with contextual metadata

### 2. **Organization Phase**
- Access your visual canvas through the extension
- Drag and arrange screenshots into meaningful clusters
- Build visual relationships between content pieces

### 3. **Analysis Phase**
- Use the integrated AI chat to query your canvas
- Ask questions like:
  - "What are the common themes across these articles?"
  - "Summarize the key findings from these research papers"
  - "Create a comparison table from these product pages"

### 4. **Creation Phase**
- Generate new documents based on your research
- Synthesize insights from multiple sources
- Export findings in various formats

## 🎮 Usage Examples

### Research & Analysis
```
User: "Analyze the design patterns shown in these 5 landing pages"
AI: "Based on your captured screenshots, I can identify 3 key design patterns:
1. Hero sections with strong CTAs (present in 4/5 pages)
2. Social proof placement below the fold (3/5 pages)
3. Minimalist navigation with max 5 menu items (5/5 pages)..."
```

### Content Creation
```
User: "Create a blog post outline comparing these competitive analysis screenshots"
AI: "# Competitive Analysis: Key Findings

## Overview
Based on your captured competitor pages...

## Feature Comparison
- Company A: Focus on automation
- Company B: Emphasis on collaboration..."
```

## 🔧 Development

### Project Structure
```
visual-canvas-ai/
├── chrome-extension/          # Extension manifest and background scripts
├── packages/
│   ├── shared/               # Shared utilities and hooks
│   │   ├── lib/hooks/        # React hooks (useChat, etc.)
│   │   ├── lib/openai/       # OpenAI integration
│   │   └── lib/chat-storage/ # Persistent storage
│   ├── ui/                   # Reusable UI components
│   │   └── lib/components/chat/ # Chat interface components
│   └── storage/              # Chrome storage helpers
├── pages/
│   ├── side-panel/           # Extension side panel
│   ├── projects/             # Main canvas interface
│   └── popup/                # Extension popup
└── dist/                     # Built extension files
```

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm type-check   # TypeScript checking
```

### Adding New Features
1. **Shared functionality** goes in `packages/shared/`
2. **UI components** go in `packages/ui/lib/components/`
3. **Page-specific code** goes in `pages/[page-name]/`

## 🤖 AI Integration Details

### OpenAI Configuration
- **Model**: GPT-4o for optimal multimodal performance
- **Context Window**: Optimized for visual content analysis
- **System Prompts**: Specialized for screenshot interpretation

### Supported AI Operations
- **Visual Analysis** - Understanding webpage layouts and content
- **Text Extraction** - OCR and content parsing from screenshots
- **Pattern Recognition** - Identifying design patterns and themes
- **Content Synthesis** - Generating new content from visual sources
- **Comparative Analysis** - Cross-referencing multiple screenshots

## 🔐 Privacy & Security

- **Local Storage** - All screenshots and data stored locally in Chrome
- **API Communication** - Only text queries sent to OpenAI (no images)
- **No Tracking** - Zero user analytics or data collection
- **Secure by Design** - Follows Chrome extension security best practices

## 🚀 Roadmap

### Current Features ✅
- Screenshot capture and organization
- AI-powered chat interface
- Visual canvas workspace
- OpenAI integration
- Persistent storage

### Coming Soon 🔮
- **Enhanced Visual Analysis** - Direct image processing
- **Export Options** - PDF, Markdown, HTML exports
- **Team Collaboration** - Shared canvas workspaces
- **Advanced Templates** - Pre-built analysis frameworks
- **Browser Sync** - Cross-device synchronization

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

**AI Development Partners:**
- **Windsurf** - Development environment and tooling
- **Anthropic Claude Opus** - Architecture design and code generation  
- **OpenAI GPT-5** - Core AI functionality and screenshot analysis
- **Claude Sonnet 4.0** - Advanced reasoning and optimization

**Built with modern web technologies and AI-first principles.**

---

**Ready to transform your web research workflow?**  
[Install the extension](#installation) and start building your visual knowledge canvas today! 🚀
