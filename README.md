# FinTrack AI

FinTrack AI is an intelligent personal finance application designed to help you take full control of your money. It leverages AI to provide smart insights, automated expense tracking, and personalized financial advice.

## ✨ Key Features

- **Dashboard:** Get a quick overview of your financial health, including total spending, remaining budget, and spending by category.
- **Expense Tracking:** Manually add, edit, or delete expenses.
- **AI-Powered Receipt Scanning:** Automatically extract expense details by uploading a receipt image.
- **Budget Management:** Set a monthly budget and track your progress in real-time.
- **AI Financial Advisor:** Chat with an AI assistant to get personalized financial advice based on your spending habits.
- **Multi-Currency Support:** Switch between various currencies (USD, EUR, GBP, JPY, KSH).
- **Dark Mode:** A sleek, eye-friendly dark theme for comfortable use in any lighting.
- **Progressive Web App (PWA):** Installable on any device for a native-app experience with offline capabilities.
- **Admin Panel:** A dedicated section for application management.

## 🚀 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (with App Router)
- **AI:** [Google's Gemini model via Genkit](https://firebase.google.com/docs/genkit)
- **UI:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/), [ShadCN UI](https://ui.shadcn.com/)
- **State Management:** React Context API
- **Form Handling:** [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Charts:** [Recharts](https://recharts.org/)

## 🏁 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/en) (v20 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/fintrack-ai.git
    cd fintrack-ai
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Firebase and Genkit API keys.
    ```
    # Add your Gemini API Key for Genkit
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

### Running the Application

To run the application in development mode, you'll need to run both the Next.js frontend and the Genkit AI server.

1.  **Start the Next.js development server:**
    ```bash
    npm run dev
    ```
    This will start the frontend on `http://localhost:3000`.

2.  **Start the Genkit server (in a separate terminal):**
    ```bash
    npm run genkit:dev
    ```
    This starts the AI flows locally, which the Next.js app will call.

## ⚙️ Available Scripts

- `npm run dev`: Starts the Next.js development server with Turbopack.
- `npm run genkit:dev`: Starts the Genkit development server.
- `npm run genkit:watch`: Starts the Genkit server in watch mode.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts a production server.
- `npm run lint`: Lints the project files using Next.js's built-in ESLint configuration.
- `npm run typecheck`: Runs TypeScript to check for type errors.

## 📂 Project Structure

```
.
├── src
│   ├── ai                # Genkit AI flows and configuration
│   ├── app               # Next.js App Router pages and layouts
│   ├── components        # Reusable React components (UI, views)
│   ├── context           # React Context for global state
│   ├── hooks             # Custom React hooks
│   ├── lib               # Utility functions and Firebase config
│   └── types             # TypeScript type definitions
├── public                # Static assets (icons, manifest)
└── ...                   # Configuration files
```

## 🔐 Firebase Configuration

The application is set up with a skeleton Firebase configuration in `src/lib/firebase.ts`. To enable user authentication and persistent cloud storage, you will need to:

1.  Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2.  Register your web app and obtain your `firebaseConfig` object.
3.  Fill in the configuration details in `src/lib/firebase.ts`.
4.  Uncomment the Firebase-related code in the application to enable authentication and data persistence.
