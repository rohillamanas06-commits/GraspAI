# 🎓 GraspAI - AI Study Assistant



## About GraspAI

GraspAI is an advanced AI-powered study assistant platform that turns your syllabus into adaptive study plans and intelligent flashcards using cutting-edge AI technology. Built with **Google Gemini 2.5 Flash** and **Natural Language Processing (NLP)** for lightning-fast, highly targeted learning.

## 📸 Screenshots

![GraspAI Screenshot 1](public/Screenshot%202026-06-23%20112523.png)
![GraspAI Screenshot 2](public/Screenshot%202026-06-23%20112633.png)
![GraspAI Screenshot 3](public/Screenshot%202026-06-23%20112657.png)
![GraspAI Screenshot 4](public/Screenshot%202026-06-24%20143708.png)



### Why GraspAI?

- 🚀 **Instant Study Plans** - Turn your syllabus PDF into a day-by-day plan in seconds
- 🎯 **High Accuracy** - Powered by Google's latest Gemini 2.5 Flash model
- 🔒 **Secure & Private** - Your study history and data are encrypted and protected
- 📱 **Accessible Anywhere** - Works perfectly on desktop, tablet, and mobile
- 🌐 **Adaptive Learning** - Your study plan evolves automatically based on your performance


### Core Functionality

#### 📄 Syllabus Extraction
- **PDF Upload** - Upload your course syllabus PDF
- **AI-Powered Parsing** - Automatically extracts subjects, topics, and subtopics
- **Weightage Analysis** - Intelligently identifies topic importance and difficulty

#### 📅 Dynamic Study Planning
- Set your target exam date and available daily study hours
- Specify weak subjects for prioritized scheduling
- Automatically schedules revision days before the exam
- Generates a beautifully structured day-by-day itinerary

#### 🗂️ NLP Flashcard Generation
- Generates precise, context-aware flashcards for every topic
- Custom sentence-scoring and pattern-matching NLP algorithms
- Choose between 3 to 15 cards per topic
- Covers definitions, processes, properties, and cause/effect

#### 📝 AI-Generated Past Papers
- Select from major Indian competitive exams (NEET, JEE Main, JEE Advanced, GATE, CAT, UPSC)
- Instantly generates highly realistic, mock past-paper questions tailored specifically to your uploaded syllabus
- Expandable solutions allowing you to test yourself before viewing the answers
- Automatically falls back to secondary LLMs (Groq) for high availability

#### 🔁 Smart Feedback Loop & Adaptation
- Interactive flashcard review sessions
- Rate flashcards as **Easy**, **Hard**, or **Skip**
- **Plan Adaptation** - The AI agent rewrites your future study plan instantly based on your feedback (allocating more time to topics you found hard)

#### 🤖 AI Tutor Chat
- Interactive conversational assistant to explain complex topics and answer doubts on the fly
- Persists your chat history and context throughout your study session

#### 📊 Study Analytics Dashboard
- **Predicted Readiness** - See your confidence levels per topic
- **Study Velocity** - Track how many flashcards you review each day over the past 7 days
- **Streaks** - Build and maintain your daily learning habits

#### 📤 Universal Export
- **Anki Integration** - Export your flashcards directly as an Anki deck (`.apkg`)
- **Google Calendar Export** - Export your study plan directly to Google Calendar (`.ics`)
- **JSON/ZIP Export** - Download your raw study plan and flashcards for external use


## 🛠️ Tech Stack

### Frontend

- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **TanStack Router** - Type-safe file-based routing
- **Shadcn UI** - Beautifully designed accessible components
  
### Backend

- **FastAPI** - High-performance Python web framework
- **PostgreSQL** - Production database (Neon)
- **NLTK** - Natural Language Toolkit for flashcard text processing

## 📁 Project Structure

```bash
 GraspAI
 ├── backend.py                  # Main FastAPI application and API routes
 ├── requirements.txt            # Python dependencies for backend
 ├── public/                     # Static assets (favicons, screenshots)
 ├── src/                        # Frontend Application Source
 │   ├── components/             # Reusable UI components
 │   │   └── ui/                 # Shadcn UI primitives
 │   ├── lib/                    # API client, utilities, and theme context
 │   ├── routeTree.gen.ts        # Auto-generated TanStack routes
 │   ├── routes/                 # File-based page components (Auth, Dashboard, Study)
 │   ├── App.tsx                 # Main application component with providers
 │   ├── main.tsx                # Application entry point
 │   └── index.css               # Global styles and Tailwind directives
 ├── components.json             # Shadcn UI configuration
 ├── postcss.config.js           # PostCSS configuration
 ├── tailwind.config.ts          # Tailwind CSS configuration
 ├── tsconfig.json               # TypeScript configuration
 ├── vite.config.ts              # Vite bundler configuration
 ├── package.json                # Node.js dependencies and scripts
 └── README.md                   # Project documentation
```

## 🚀 Getting Started

- **Google Gemini 2.5 Flash** - AI model for syllabus analysis and plan adaptation
- **PostgreSQL (Neon)** - Serverless database
- **NLTK** - Python NLP toolkit


Made With ❤️ By Manas Rohilla
