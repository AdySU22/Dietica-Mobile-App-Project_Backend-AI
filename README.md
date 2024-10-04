# Dietica-Mobile-App-Project_Backend-AI

## Prerequisites

To run this project locally or deploy it to Firebase, you need the following:

- [Node.js](https://nodejs.org/) (v18 or later)
- [Firebase CLI](https://firebase.google.com/docs/cli) (v9.0 or later)

## Setup

1. **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2. **Install dependencies:**
    Install the necessary npm packages for Cloud Functions:
    ```bash
    # Navigate to the functions directory
    cd functions
    # Install dependencies from package.json inside the functions directory
    npm install
    # Navigate back to the root directory
    cd ..
    ```

3. **Firebase configuration:**
    Login to Firebase and link the project with your Firebase project:
    ```bash
    firebase login
    firebase use --add
    ```
    Select **dietica-be3e3**

4. **Setup environment variables:**
  If you're using environment variables in cloud functions for sensitive data, use `.env` inside the `functions` directory

## Local Development

You can test Firebase functions locally using the Firebase Emulator. This is useful for rapid development without needing to deploy each time.

**Start the emulator:**
  ```bash
  firebase emulators:start
  ```

Currently, it only emulates Authentication, Firestore, and Functions.

## Deployment

To deploy your functions to Firebase's production environment, run:

```bash
firebase deploy --only functions
```

You can deploy specific functions by specifying their names:

```bash
firebase deploy --only functions:functionName
```
