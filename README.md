# 🖐️ Computer Vision AR UI

### Pulling reply windows out of thin air.

What if the future of human-computer interaction wasn't about screens at all—but about the space around you?

This project explores a radical vision: **controlling augmented reality interfaces using nothing but your hands**. No controllers. No buttons. Just intuitive gesture recognition powered by onboard cameras—the kind that could one day live inside the frames of your smart glasses.

Imagine flicking through notifications mid-conversation. Pulling up a message window with a pinch. Dismissing it with a wave. All without breaking eye contact with the world around you.

This is that experiment, brought to life.

---

## Features

- **Real-time Hand Tracking** — Powered by MediaPipe's state-of-the-art hand detection
- **Gesture-Based Interaction** — Control UI elements through natural hand movements
- **3D Spatial Interface** — Built with React Three Fiber for immersive AR simulation
- **Zero Hardware Requirements** — Works with any standard webcam

---

## Gesture Controls

New to gesture-based UI? Here's how to interact:

### Single Hand Gestures

| Gesture | How To | What It Does |
|---------|--------|--------------|
| **Pinch** | Touch thumb to index finger | "Grab" or select objects |
| **Drag** | Pinch + move hand | Move the floating sphere through 3D space |
| **Release** | Separate thumb from index | Drop held objects |
| **Hover** | Move hand over UI elements | Highlight interactive elements |

### Two-Hand Gestures

| Gesture | How To | What It Does |
|---------|--------|--------------|
| **Pull Apart** | Pinch with BOTH hands, then separate them | Opens a message reply window |
| **Resize** | While pulling, spread hands further | Window grows larger as hands move apart |
| **Hold Open** | Keep both hands pinching | Keeps the window open |
| **Close** | Release both pinches (or wait after speaking) | Closes the window |

### Pro Tips

- **Grabbing the sphere**: Get your hand close to the sphere, *then* pinch. Distance matters!
- **Opening windows**: Start with hands close together, then pull apart like stretching taffy
- **Voice replies**: The microphone activates automatically when you open a message window—just start talking
- **Menu navigation**: Hover over the hamburger menu (top-right), pinch to open, then hover + pinch on options

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher) or [Bun](https://bun.sh/)
- A webcam (built-in or external)
- A modern browser with WebGL support

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Seth141/Computer-Vision-AR-UI.git
   cd Computer-Vision-AR-UI
   ```

2. **Install dependencies**

   Using Bun (recommended):
   ```bash
   bun install
   ```

   Or using npm:
   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   bun dev
   ```
   or
   ```bash
   npm run dev
   ```

4. **Open in your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

5. **Grant camera access** when prompted, and start waving 

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework & routing |
| **React Three Fiber** | 3D rendering & WebGL |
| **MediaPipe Hands** | Real-time hand tracking |
| **Tailwind CSS** | Styling |
| **TypeScript** | Type safety |

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Run production build |
| `bun lint` | Run ESLint |

---

## The Vision

This isn't just a tech demo—it's a glimpse into a world where the boundary between digital and physical dissolves. Where your hands become the interface. Where AR isn't something you look *at*, but something you reach *into*.

The future is gestural. Let's build it.

---

<p align="center">
  <i>Built with curiosity and caffeine ☕</i>
</p>
