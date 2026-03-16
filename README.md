# 🚀 Orbital Meltdown

> **A real-time, voice-controlled crisis simulation powered by the Gemini Live API.**
> Built for the **Gemini Live Agent Challenge** (Live Agents Category).

[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now-06b6d4?style=for-the-badge)](https://ais-pre-5mwngptnrbw7plgf7d4a6q-12932369960.asia-east1.run.app)
*(Note: Requires microphone permissions to play)*

## ⚠️ The Crisis
Current AI agents are often just static chatbots taking turns in a text box. **Orbital Meltdown** proves that the Gemini Live API can handle high-stress, low-latency, stateful UI experiences. 

You are the captain of an orbital station experiencing a catastrophic core breach. You have **2 minutes** to repair 5 critical components. Your only help is **A.N.I.T.A.**, the station's highly advanced (and slightly panicked) AI.

## 🎮 How to Play

1. **Connect the COMM LINK:** Click the microphone icon to establish a WebSocket connection to A.N.I.T.A.
2. **Speak Naturally:** Ask A.N.I.T.A. for the repair sequence. You can interrupt her at any time if you panic or miss an instruction!
3. **Two Modes of Play:**
   * **Standard Protocol:** A.N.I.T.A. reads the sequence. You must physically click the correct components on the dashboard. If you click the wrong one, the system surges and you lose 15 seconds.
   * **Cognitive Lockdown:** Components are locked! A.N.I.T.A. will ask you a trivia question (Maths, Geography, or Finance). You must **speak the correct answer** to her. She uses function calling to evaluate your answer and unlock the component.

## ✨ Key Features & Gemini Integration

* **Real-Time Voice (Gemini Live API):** Utilizes the `gemini-2.5-flash-native-audio-preview` model via WebSockets for ultra-low latency, natural voice conversations.
* **Interruptibility:** Because it uses the Live API, you can talk over A.N.I.T.A. and she will stop and listen to you.
* **UI Manipulation via Function Calling:** A.N.I.T.A. isn't just a voice; she controls the game. She uses the `highlight_dashboard_element` tool to visually flash components on your screen to guide you.
* **Dynamic Evaluation:** In Cognitive mode, A.N.I.T.A. uses the `evaluate_answer` tool to judge if your spoken answer to her trivia question is correct, triggering React state changes to progress the game.

## 🏗️ Architecture & Tech Stack

* **Frontend:** Next.js (App Router), React, Tailwind CSS, Framer Motion.
* **AI:** Google GenAI SDK (`@google/genai`), Gemini Live API.
* **Deployment:** Natively provisioned and deployed on **Google Cloud Run** (Serverless container).

### How the State Works
The Next.js frontend acts as the source of truth for the game state (timer, target sequence). It communicates with the Gemini Live API via WebSockets. When the user clicks a component, the frontend sends a silent `SYSTEM NOTIFICATION` text prompt to the AI, updating its context without breaking the audio immersion.

## ☁️ Proof of Google Cloud Deployment

This application was developed using Google AI Studio Build, which natively provisions and deploys the full-stack application directly to **Google Cloud Run**. 

You can verify our active Google Cloud deployment by looking at our live demo URL, which is hosted on the official Cloud Run domain (`.run.app`):
[https://ais-pre-5mwngptnrbw7plgf7d4a6q-12932369960.asia-east1.run.app](https://ais-pre-5mwngptnrbw7plgf7d4a6q-12932369960.asia-east1.run.app)

## 🛠️ Local Setup Instructions

If you want to run this simulation locally:

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your Gemini API key:
   ```env
   NEXT_PUBLIC_GEMINI_API_KEY="your_api_key_here"
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---
*Built with [Google AI Studio](https://aistudio.google.com/)*
