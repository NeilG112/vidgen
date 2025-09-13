# RecruitFlow

RecruitFlow is a full-stack SaaS application for recruiters to streamline outreach by scraping LinkedIn profiles and generating personalized video introductions.

This application is built with Next.js, Firebase, and integrates with Apify for web scraping and HeyGen for AI video generation.

## Features

- **Secure Authentication**: Email & password login managed by Firebase Auth.
- **LinkedIn Profile Scraping**: Scrape candidate data from LinkedIn URLs using Apify.
- **Profile Management**: View and manage scraped profiles in a clean, organized table.
- **AI Video Generation**: Create personalized intro videos for candidates using HeyGen's API.
- **Cloud Storage**: Videos are automatically uploaded to Firebase Storage.
- **Job Tracking**: Monitor the status of scraping and video generation jobs.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth)
- **Database**: [Cloud Firestore](https://firebase.google.com/docs/firestore)
- **Storage**: [Cloud Storage for Firebase](https://firebase.google.com/docs/storage)
- **Web Scraping**: [Apify](https://apify.com/)
- **AI Video**: [HeyGen](https://www.heygen.com/)

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- A Firebase project
- API keys for Apify and HeyGen

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd recruitflow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of the project by copying the example file:
    ```bash
    cp .env.example .env.local
    ```
    Populate `.env.local` with your credentials from Firebase, Apify, and HeyGen. See the comments in the file for guidance on where to find each value.

4.  **Set up Firebase:**
    - Create a new project in the [Firebase Console](https://console.firebase.google.com/).
    - Go to Project Settings -> General and add a new Web App. Copy the `firebaseConfig` values into your `.env.local` file.
    - Go to Project Settings -> Service Accounts. Generate a new private key and use its contents for the `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` variables.
    - In the Firebase Console, enable Authentication (with Email/Password provider), Firestore, and Storage.
    - Manually add a user in the Authentication tab so you can log in.

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) (or your specified port) with your browser to see the result.

## Usage

1.  Log in using the credentials you created in the Firebase console.
2.  Navigate to the dashboard.
3.  Enter LinkedIn profile URLs to scrape.
4.  Once profiles are scraped, they will appear in the table.
5.  Click "Generate Intro Video" to create a personalized video for a candidate.
6.  Track the progress of your jobs on the "Jobs" page.
